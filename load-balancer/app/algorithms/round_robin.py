"""
Round Robin Algorithm

Distributes requests sequentially across healthy servers.
Request 1 → Server 1, Request 2 → Server 2, …, then wraps around.
Unhealthy servers are automatically skipped because the caller
only passes healthy servers.
"""
from __future__ import annotations
from typing import Optional
from app.models import ServerInfo


class RoundRobin:
    """Stateful round-robin selector."""

    def __init__(self) -> None:
        self._index: int = 0

    def select(self, servers: list[ServerInfo]) -> Optional[ServerInfo]:
        """Return the next server in round-robin order, or None if empty."""
        if not servers:
            return None
        # Ensure index wraps correctly even if the pool size changed
        self._index = self._index % len(servers)
        selected = servers[self._index]
        self._index = (self._index + 1) % len(servers)
        return selected

    def reset(self) -> None:
        self._index = 0
