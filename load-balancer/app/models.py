"""
LoadFlow — Server model shared across the load-balancer.
"""
from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


class ServerStatus(str, Enum):
    HEALTHY = "healthy"
    BUSY = "busy"
    UNHEALTHY = "unhealthy"
    OFFLINE = "offline"


class ServerInfo(BaseModel):
    """Represents a backend server known to the load balancer."""

    server_id: str
    url: str  # e.g. http://server1:8001
    status: ServerStatus = ServerStatus.OFFLINE
    weight: int = Field(default=1, ge=1, le=10)
    active_connections: int = 0
    total_requests: int = 0
    avg_response_time: float = 0.0
    requests_per_second: int = 0
    application_load: float = 0.0
    uptime_seconds: float = 0.0
    enabled: bool = True  # mirrors the backend's own flag
    last_health_check: Optional[float] = None  # unix timestamp


class RequestLog(BaseModel):
    """A single request-log entry."""

    timestamp: str
    request_id: str
    algorithm: str
    server_id: str
    response_time: float
    status: str  # "success" | "failed"


class AlgorithmType(str, Enum):
    ROUND_ROBIN = "round_robin"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_LEAST_CONNECTIONS = "weighted_least_connections"
