"""
LoadFlow Backend Server
An independent backend server instance that processes requests
and reports health/metrics to the load balancer.
"""
import os
import time
import uuid
import random
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ---------- configuration ----------

SERVER_ID = os.getenv("SERVER_ID", "server-1")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8001"))
# Base processing delay (ms).  Configurable per-server to show algorithm effects.
BASE_DELAY_MS = int(os.getenv("BASE_DELAY_MS", "100"))
# Random jitter added on top of the base delay (ms).
DELAY_JITTER_MS = int(os.getenv("DELAY_JITTER_MS", "50"))

# ---------- state ----------


class ServerState:
    """Mutable runtime state for this server instance."""

    def __init__(self) -> None:
        self.enabled: bool = True  # can be toggled to simulate failure
        self.active_connections: int = 0
        self.total_requests: int = 0
        self.total_processing_time_ms: float = 0.0
        self.requests_last_second: int = 0
        self.start_time: float = time.time()
        # Rolling window for RPS calculation
        self._request_timestamps: list[float] = []

    @property
    def avg_response_time(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return round(self.total_processing_time_ms / self.total_requests, 2)

    @property
    def uptime_seconds(self) -> float:
        return round(time.time() - self.start_time, 2)

    def record_rps_tick(self) -> None:
        """Prune timestamps older than 1 second and count recent ones."""
        now = time.time()
        self._request_timestamps = [
            t for t in self._request_timestamps if now - t < 1.0
        ]
        self.requests_last_second = len(self._request_timestamps)

    def record_request_start(self) -> None:
        self.active_connections += 1
        self._request_timestamps.append(time.time())

    def record_request_end(self, processing_time_ms: float) -> None:
        self.active_connections = max(0, self.active_connections - 1)
        self.total_requests += 1
        self.total_processing_time_ms += processing_time_ms


state = ServerState()

# ---------- background tasks ----------

_rps_task: Optional[asyncio.Task] = None


async def _rps_loop() -> None:
    """Recalculate requests-per-second every 500 ms."""
    while True:
        state.record_rps_tick()
        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _rps_task
    _rps_task = asyncio.create_task(_rps_loop())
    yield
    if _rps_task:
        _rps_task.cancel()


# ---------- app ----------

app = FastAPI(
    title=f"LoadFlow Backend — {SERVER_ID}",
    description="Individual backend server instance for the LoadFlow platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- models ----------


class ProcessResponse(BaseModel):
    server_id: str
    status: str
    processing_time: float
    timestamp: str
    request_id: str


class HealthResponse(BaseModel):
    server_id: str
    status: str
    active_connections: int
    total_requests: int
    avg_response_time: float
    uptime_seconds: float
    enabled: bool


class MetricsResponse(BaseModel):
    server_id: str
    active_connections: int
    total_requests: int
    avg_response_time: float
    requests_per_second: int
    uptime_seconds: float
    application_load: float  # 0-100 simulated utilization


class ToggleResponse(BaseModel):
    server_id: str
    enabled: bool
    message: str


# ---------- helpers ----------


def _compute_application_load() -> float:
    """
    Compute a simulated 'application load' percentage.
    This is NOT real CPU — it is based on active connections and recent throughput.
    """
    # Simple heuristic: each active connection contributes ~12%, rps contributes ~2%
    load = min(
        100.0,
        state.active_connections * 12.0 + state.requests_last_second * 2.0
    )
    # Add a tiny random component so charts look alive
    load += random.uniform(-2, 2)
    return round(max(0.0, min(100.0, load)), 1)


# ---------- routes ----------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health endpoint called by the load balancer."""
    if not state.enabled:
        raise HTTPException(status_code=503, detail="Server is disabled (simulated failure)")

    return HealthResponse(
        server_id=SERVER_ID,
        status="healthy",
        active_connections=state.active_connections,
        total_requests=state.total_requests,
        avg_response_time=state.avg_response_time,
        uptime_seconds=state.uptime_seconds,
        enabled=state.enabled,
    )


@app.get("/process", response_model=ProcessResponse)
async def process_request() -> ProcessResponse:
    """
    Simulate processing a request.
    The server waits for a configurable delay, then responds.
    """
    if not state.enabled:
        raise HTTPException(status_code=503, detail="Server is disabled (simulated failure)")

    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    state.record_request_start()

    # Simulate work
    delay_ms = BASE_DELAY_MS + random.randint(0, DELAY_JITTER_MS)
    start = time.monotonic()
    await asyncio.sleep(delay_ms / 1000.0)
    actual_ms = round((time.monotonic() - start) * 1000, 2)

    state.record_request_end(actual_ms)

    return ProcessResponse(
        server_id=SERVER_ID,
        status="processed",
        processing_time=actual_ms,
        timestamp=datetime.utcnow().isoformat(),
        request_id=request_id,
    )


@app.get("/metrics", response_model=MetricsResponse)
async def metrics() -> MetricsResponse:
    """Return current server metrics."""
    return MetricsResponse(
        server_id=SERVER_ID,
        active_connections=state.active_connections,
        total_requests=state.total_requests,
        avg_response_time=state.avg_response_time,
        requests_per_second=state.requests_last_second,
        uptime_seconds=state.uptime_seconds,
        application_load=_compute_application_load(),
    )


@app.post("/disable", response_model=ToggleResponse)
async def disable_server() -> ToggleResponse:
    """Simulate server failure by disabling this instance."""
    state.enabled = False
    return ToggleResponse(
        server_id=SERVER_ID,
        enabled=False,
        message=f"{SERVER_ID} has been disabled (simulated failure).",
    )


@app.post("/enable", response_model=ToggleResponse)
async def enable_server() -> ToggleResponse:
    """Re-enable a previously disabled server."""
    state.enabled = True
    return ToggleResponse(
        server_id=SERVER_ID,
        enabled=True,
        message=f"{SERVER_ID} has been re-enabled.",
    )


@app.get("/")
async def root():
    return {"server_id": SERVER_ID, "status": "running", "enabled": state.enabled}
