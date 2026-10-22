"""
Least Connections Algorithm

Routes each new request to the healthy server with the fewest
active connections.  Ties are broken by server order (first wins).
"""
from __future__ import annotations
from typing import Optional
from app.models import ServerInfo


class LeastConnections:
    """Least-connections selector (stateless — reads live metrics)."""

    def select(self, servers: list[ServerInfo]) -> Optional[ServerInfo]:
        if not servers:
            return None
        return min(servers, key=lambda s: s.active_connections)

    def reset(self) -> None:
        pass  # no internal state
