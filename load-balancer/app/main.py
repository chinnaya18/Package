"""
LoadFlow — Load Balancer / API Gateway

Central FastAPI service that:
  • Maintains a registry of backend servers
  • Periodically health-checks every server
  • Routes incoming /api/request calls through a selected algorithm
  • Exposes REST + WebSocket APIs consumed by the React dashboard
"""
from __future__ import annotations

import os
import asyncio
import time
import uuid
import json
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.models import ServerInfo, ServerStatus, RequestLog, AlgorithmType
from app.algorithms.round_robin import RoundRobin
from app.algorithms.weighted_round_robin import WeightedRoundRobin
from app.algorithms.least_connections import LeastConnections
from app.algorithms.weighted_least_connections import WeightedLeastConnections

# ─── Configuration ────────────────────────────────────────────────────

HEALTH_CHECK_INTERVAL = int(os.getenv("HEALTH_CHECK_INTERVAL", "3"))  # seconds

# Server definitions from env (easy to extend)
_DEFAULT_SERVERS = {
    "server-1": {"url": os.getenv("SERVER_1_URL", "http://server1:8001"), "weight": 5},
    "server-2": {"url": os.getenv("SERVER_2_URL", "http://server2:8001"), "weight": 3},
    "server-3": {"url": os.getenv("SERVER_3_URL", "http://server3:8001"), "weight": 1},
    "server-4": {"url": os.getenv("SERVER_4_URL", "http://server4:8001"), "weight": 2},
}

# ─── Global State ─────────────────────────────────────────────────────


class LoadBalancerState:
    def __init__(self) -> None:
        self.servers: dict[str, ServerInfo] = {}
        self.current_algorithm: AlgorithmType = AlgorithmType.ROUND_ROBIN
        self.request_logs: list[RequestLog] = []
        self.max_logs: int = 2000  # cap stored logs
        self.total_requests: int = 0
        self.successful_requests: int = 0
        self.failed_requests: int = 0
        self._request_timestamps: list[float] = []
        self.traffic_running: bool = False
        self._traffic_task: Optional[asyncio.Task] = None

        # Algorithm instances
        self.algorithms = {
            AlgorithmType.ROUND_ROBIN: RoundRobin(),
            AlgorithmType.WEIGHTED_ROUND_ROBIN: WeightedRoundRobin(),
            AlgorithmType.LEAST_CONNECTIONS: LeastConnections(),
            AlgorithmType.WEIGHTED_LEAST_CONNECTIONS: WeightedLeastConnections(),
        }

    # ── helpers ──

    def healthy_servers(self) -> list[ServerInfo]:
        return [s for s in self.servers.values() if s.status == ServerStatus.HEALTHY]

    def select_server(self) -> Optional[ServerInfo]:
        algo = self.algorithms[self.current_algorithm]
        return algo.select(self.healthy_servers())

    def add_log(self, log: RequestLog) -> None:
        self.request_logs.append(log)
        if len(self.request_logs) > self.max_logs:
            self.request_logs = self.request_logs[-self.max_logs:]

    def requests_per_second(self) -> int:
        now = time.time()
        self._request_timestamps = [
            t for t in self._request_timestamps if now - t < 1.0
        ]
        return len(self._request_timestamps)


state = LoadBalancerState()

# WebSocket clients
ws_clients: list[WebSocket] = []

# Shared httpx client
http_client: httpx.AsyncClient = None  # type: ignore[assignment]


# ─── Background Tasks ─────────────────────────────────────────────────

async def health_check_loop() -> None:
    """Periodically probe every registered backend server."""
    while True:
        for server in state.servers.values():
            try:
                resp = await http_client.get(
                    f"{server.url}/health", timeout=2.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    server.status = ServerStatus.HEALTHY
                    server.active_connections = data.get("active_connections", 0)
                    server.total_requests = data.get("total_requests", 0)
                    server.avg_response_time = data.get("avg_response_time", 0.0)
                    server.uptime_seconds = data.get("uptime_seconds", 0.0)
                    server.enabled = data.get("enabled", True)
                elif resp.status_code == 503:
                    server.status = ServerStatus.OFFLINE
                    server.enabled = False
                else:
                    server.status = ServerStatus.UNHEALTHY
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, Exception):
                server.status = ServerStatus.OFFLINE
                server.active_connections = 0

            server.last_health_check = time.time()

            # Also grab metrics
            if server.status == ServerStatus.HEALTHY:
                try:
                    mr = await http_client.get(
                        f"{server.url}/metrics", timeout=2.0
                    )
                    if mr.status_code == 200:
                        md = mr.json()
                        server.requests_per_second = md.get("requests_per_second", 0)
                        server.application_load = md.get("application_load", 0.0)
                except Exception:
                    pass

        # Push update to WS clients
        await broadcast_metrics()
        await asyncio.sleep(HEALTH_CHECK_INTERVAL)


async def broadcast_metrics() -> None:
    """Send current metrics snapshot to all connected WebSocket clients."""
    payload = _build_metrics_payload()
    msg = json.dumps(payload)
    disconnected: list[WebSocket] = []
    for ws in ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in ws_clients:
            ws_clients.remove(ws)


def _build_metrics_payload() -> dict:
    servers_data = []
    for s in state.servers.values():
        servers_data.append({
            "server_id": s.server_id,
            "url": s.url,
            "status": s.status.value,
            "weight": s.weight,
            "active_connections": s.active_connections,
            "total_requests": s.total_requests,
            "avg_response_time": s.avg_response_time,
            "requests_per_second": s.requests_per_second,
            "application_load": s.application_load,
            "uptime_seconds": s.uptime_seconds,
            "enabled": s.enabled,
        })

    healthy_count = len(state.healthy_servers())
    total_avg = 0.0
    if state.successful_requests > 0:
        total_avg = sum(
            l.response_time for l in state.request_logs if l.status == "success"
        ) / state.successful_requests

    return {
        "type": "metrics",
        "servers": servers_data,
        "algorithm": state.current_algorithm.value,
        "overall": {
            "total_requests": state.total_requests,
            "successful_requests": state.successful_requests,
            "failed_requests": state.failed_requests,
            "requests_per_second": state.requests_per_second(),
            "avg_response_time": round(total_avg, 2),
            "active_connections": sum(s.active_connections for s in state.servers.values()),
            "healthy_servers": healthy_count,
            "offline_servers": len(state.servers) - healthy_count,
        },
        "traffic_running": state.traffic_running,
    }


# ─── Lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()

    # Register servers
    for sid, cfg in _DEFAULT_SERVERS.items():
        state.servers[sid] = ServerInfo(
            server_id=sid,
            url=cfg["url"],
            weight=cfg["weight"],
            status=ServerStatus.OFFLINE,
        )

    # Start health check loop
    hc_task = asyncio.create_task(health_check_loop())
    yield
    hc_task.cancel()
    await http_client.aclose()


# ─── App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="LoadFlow — Load Balancer",
    description="Central load balancer and API gateway for the LoadFlow platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ─────────────────────────────────────────

class AlgorithmRequest(BaseModel):
    algorithm: AlgorithmType


class TrafficRequest(BaseModel):
    total_requests: int = Field(ge=1, le=5000)
    requests_per_second: int = Field(ge=1, le=200)


class WeightUpdateRequest(BaseModel):
    weight: int = Field(ge=1, le=10)


class ComparisonRequest(BaseModel):
    total_requests: int = Field(default=100, ge=10, le=1000)


class ServerIdPath(BaseModel):
    server_id: str


# ─── REST Endpoints ───────────────────────────────────────────────────

@app.get("/api/servers")
async def get_servers():
    return [
        {
            "server_id": s.server_id,
            "url": s.url,
            "status": s.status.value,
            "weight": s.weight,
            "active_connections": s.active_connections,
            "total_requests": s.total_requests,
            "avg_response_time": s.avg_response_time,
            "requests_per_second": s.requests_per_second,
            "application_load": s.application_load,
            "uptime_seconds": s.uptime_seconds,
            "enabled": s.enabled,
        }
        for s in state.servers.values()
    ]


@app.get("/api/servers/{server_id}")
async def get_server(server_id: str):
    s = state.servers.get(server_id)
    if not s:
        raise HTTPException(404, f"Server '{server_id}' not found")
    return {
        "server_id": s.server_id,
        "url": s.url,
        "status": s.status.value,
        "weight": s.weight,
        "active_connections": s.active_connections,
        "total_requests": s.total_requests,
        "avg_response_time": s.avg_response_time,
        "requests_per_second": s.requests_per_second,
        "application_load": s.application_load,
        "uptime_seconds": s.uptime_seconds,
        "enabled": s.enabled,
    }


@app.get("/api/health")
async def lb_health():
    return {
        "status": "healthy",
        "servers": len(state.servers),
        "healthy": len(state.healthy_servers()),
    }


@app.get("/api/metrics")
async def get_metrics():
    return _build_metrics_payload()


@app.get("/api/algorithm")
async def get_algorithm():
    return {"algorithm": state.current_algorithm.value}


@app.post("/api/algorithm")
async def set_algorithm(body: AlgorithmRequest):
    state.current_algorithm = body.algorithm
    # Reset stateful algorithms so they start fresh
    for algo in state.algorithms.values():
        algo.reset()
    await broadcast_metrics()
    return {"algorithm": state.current_algorithm.value}


@app.put("/api/servers/{server_id}/weight")
async def update_weight(server_id: str, body: WeightUpdateRequest):
    s = state.servers.get(server_id)
    if not s:
        raise HTTPException(404, f"Server '{server_id}' not found")
    s.weight = body.weight
    # Force WRR schedule rebuild
    state.algorithms[AlgorithmType.WEIGHTED_ROUND_ROBIN].reset()
    return {"server_id": server_id, "weight": s.weight}


# ─── Request Routing ──────────────────────────────────────────────────

@app.post("/api/request")
async def route_request():
    """Route a single request through the current algorithm."""
    server = state.select_server()
    state.total_requests += 1
    state._request_timestamps.append(time.time())

    if not server:
        state.failed_requests += 1
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=f"REQ-{uuid.uuid4().hex[:8].upper()}",
            algorithm=state.current_algorithm.value,
            server_id="none",
            response_time=0,
            status="failed",
        )
        state.add_log(log)
        await broadcast_metrics()
        raise HTTPException(
            503,
            "Service temporarily unavailable — no healthy backend servers.",
        )

    start = time.monotonic()
    try:
        resp = await http_client.get(f"{server.url}/process", timeout=10.0)
        elapsed = round((time.monotonic() - start) * 1000, 2)
        data = resp.json()
        request_id = data.get("request_id", f"REQ-{uuid.uuid4().hex[:8].upper()}")

        state.successful_requests += 1
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id,
            algorithm=state.current_algorithm.value,
            server_id=server.server_id,
            response_time=elapsed,
            status="success",
        )
        state.add_log(log)

        # Broadcast event for live request flow
        event = {
            "type": "request_routed",
            "request_id": request_id,
            "server_id": server.server_id,
            "algorithm": state.current_algorithm.value,
            "response_time": elapsed,
            "status": "success",
        }
        await _broadcast_event(event)
        await broadcast_metrics()

        return {
            "request_id": request_id,
            "server_id": server.server_id,
            "algorithm": state.current_algorithm.value,
            "response_time": elapsed,
            "status": "success",
            "server_response": data,
        }
    except Exception as exc:
        elapsed = round((time.monotonic() - start) * 1000, 2)
        state.failed_requests += 1
        req_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=req_id,
            algorithm=state.current_algorithm.value,
            server_id=server.server_id,
            response_time=elapsed,
            status="failed",
        )
        state.add_log(log)
        await broadcast_metrics()
        return {
            "request_id": req_id,
            "server_id": server.server_id,
            "algorithm": state.current_algorithm.value,
            "response_time": elapsed,
            "status": "failed",
            "error": str(exc),
        }


async def _broadcast_event(event: dict) -> None:
    msg = json.dumps(event)
    disconnected: list[WebSocket] = []
    for ws in ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in ws_clients:
            ws_clients.remove(ws)


# ─── Server Control ──────────────────────────────────────────────────

@app.post("/api/servers/{server_id}/stop")
async def stop_server(server_id: str):
    s = state.servers.get(server_id)
    if not s:
        raise HTTPException(404, f"Server '{server_id}' not found")
    try:
        await http_client.post(f"{s.url}/disable", timeout=3.0)
    except Exception:
        pass
    s.status = ServerStatus.OFFLINE
    s.enabled = False
    s.active_connections = 0
    await broadcast_metrics()
    return {"server_id": server_id, "status": "offline"}


@app.post("/api/servers/{server_id}/start")
async def start_server(server_id: str):
    s = state.servers.get(server_id)
    if not s:
        raise HTTPException(404, f"Server '{server_id}' not found")
    try:
        await http_client.post(f"{s.url}/enable", timeout=3.0)
    except Exception:
        pass
    s.enabled = True
    # Next health check will mark it healthy
    await broadcast_metrics()
    return {"server_id": server_id, "status": "recovering"}


# ─── Traffic Generator ───────────────────────────────────────────────

@app.post("/api/traffic/start")
async def start_traffic(body: TrafficRequest):
    if state.traffic_running:
        raise HTTPException(409, "Traffic generation already running")

    state.traffic_running = True

    async def _generate_traffic():
        sent = 0
        interval = 1.0 / body.requests_per_second if body.requests_per_second > 0 else 1.0
        try:
            while sent < body.total_requests and state.traffic_running:
                # Fire request (don't await response sequentially for high RPS)
                asyncio.create_task(_fire_traffic_request())
                sent += 1
                await asyncio.sleep(interval)
        finally:
            state.traffic_running = False
            await broadcast_metrics()

    state._traffic_task = asyncio.create_task(_generate_traffic())
    return {"status": "started", "total_requests": body.total_requests, "rps": body.requests_per_second}


async def _fire_traffic_request():
    """Fire one request through the load balancer for traffic generation."""
    server = state.select_server()
    state.total_requests += 1
    state._request_timestamps.append(time.time())

    if not server:
        state.failed_requests += 1
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=f"REQ-{uuid.uuid4().hex[:8].upper()}",
            algorithm=state.current_algorithm.value,
            server_id="none",
            response_time=0,
            status="failed",
        )
        state.add_log(log)
        return

    start = time.monotonic()
    try:
        resp = await http_client.get(f"{server.url}/process", timeout=10.0)
        elapsed = round((time.monotonic() - start) * 1000, 2)
        data = resp.json()
        request_id = data.get("request_id", f"REQ-{uuid.uuid4().hex[:8].upper()}")
        state.successful_requests += 1
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id,
            algorithm=state.current_algorithm.value,
            server_id=server.server_id,
            response_time=elapsed,
            status="success",
        )
        state.add_log(log)
        event = {
            "type": "request_routed",
            "request_id": request_id,
            "server_id": server.server_id,
            "algorithm": state.current_algorithm.value,
            "response_time": elapsed,
            "status": "success",
        }
        await _broadcast_event(event)
    except Exception:
        elapsed = round((time.monotonic() - start) * 1000, 2)
        state.failed_requests += 1
        req_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
        log = RequestLog(
            timestamp=datetime.utcnow().isoformat(),
            request_id=req_id,
            algorithm=state.current_algorithm.value,
            server_id=server.server_id,
            response_time=elapsed,
            status="failed",
        )
        state.add_log(log)


@app.post("/api/traffic/stop")
async def stop_traffic():
    state.traffic_running = False
    if state._traffic_task and not state._traffic_task.done():
        state._traffic_task.cancel()
    await broadcast_metrics()
    return {"status": "stopped"}


# ─── Request Logs ─────────────────────────────────────────────────────

@app.get("/api/logs")
async def get_logs(
    server: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(default=200, ge=1, le=2000),
):
    logs = list(reversed(state.request_logs))  # newest first
    if server:
        logs = [l for l in logs if l.server_id == server]
    if status:
        logs = [l for l in logs if l.status == status]
    if search:
        logs = [l for l in logs if search.upper() in l.request_id.upper()]
    return logs[:limit]


@app.post("/api/logs/clear")
async def clear_logs():
    state.request_logs.clear()
    return {"status": "cleared"}


# ─── Algorithm Comparison ────────────────────────────────────────────

@app.post("/api/test")
async def run_comparison(body: ComparisonRequest):
    """
    Run a controlled test with each algorithm and return comparison data.
    """
    results = {}
    original_algo = state.current_algorithm

    for algo_type in AlgorithmType:
        # Reset algorithm state
        state.algorithms[algo_type].reset()
        state.current_algorithm = algo_type

        # Track per-server counts and times
        per_server: dict[str, dict] = {}
        for sid in state.servers:
            per_server[sid] = {"count": 0, "times": [], "failed": 0}

        total_ok = 0
        total_fail = 0

        for _ in range(body.total_requests):
            server = state.select_server()
            if not server:
                total_fail += 1
                continue

            try:
                start = time.monotonic()
                resp = await http_client.get(f"{server.url}/process", timeout=10.0)
                elapsed = round((time.monotonic() - start) * 1000, 2)
                if resp.status_code == 200:
                    total_ok += 1
                    per_server[server.server_id]["count"] += 1
                    per_server[server.server_id]["times"].append(elapsed)
                else:
                    total_fail += 1
                    per_server[server.server_id]["failed"] += 1
            except Exception:
                total_fail += 1
                if server:
                    per_server[server.server_id]["failed"] += 1

        # Compute summary
        server_stats = []
        all_times: list[float] = []
        counts = []
        for sid, data in per_server.items():
            times = data["times"]
            all_times.extend(times)
            counts.append(data["count"])
            server_stats.append({
                "server_id": sid,
                "requests": data["count"],
                "failed": data["failed"],
                "avg_response_time": round(sum(times) / len(times), 2) if times else 0,
                "max_response_time": round(max(times), 2) if times else 0,
            })

        # Fairness: coefficient of variation (lower = fairer)
        if counts and sum(counts) > 0:
            mean_c = sum(counts) / len(counts)
            if mean_c > 0:
                variance = sum((c - mean_c) ** 2 for c in counts) / len(counts)
                std_dev = variance ** 0.5
                cv = std_dev / mean_c
                fairness = round(max(0, (1 - cv)) * 100, 1)
            else:
                fairness = 0.0
        else:
            fairness = 0.0

        results[algo_type.value] = {
            "algorithm": algo_type.value,
            "total_requests": body.total_requests,
            "successful": total_ok,
            "failed": total_fail,
            "avg_response_time": round(sum(all_times) / len(all_times), 2) if all_times else 0,
            "max_response_time": round(max(all_times), 2) if all_times else 0,
            "distribution_fairness": fairness,
            "servers": server_stats,
        }

    # Restore original algorithm
    state.current_algorithm = original_algo
    state.algorithms[original_algo].reset()

    return results


# ─── WebSocket ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        # Send initial state
        await ws.send_text(json.dumps(_build_metrics_payload()))
        while True:
            # Keep alive — also accept any messages from client
            data = await ws.receive_text()
            # Client can send ping
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if ws in ws_clients:
            ws_clients.remove(ws)


@app.get("/")
async def root():
    return {
        "service": "LoadFlow Load Balancer",
        "version": "1.0.0",
        "algorithm": state.current_algorithm.value,
        "servers": len(state.servers),
        "healthy": len(state.healthy_servers()),
    }
