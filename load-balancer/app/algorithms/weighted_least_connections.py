"""
Weighted Least Connections Algorithm

Combines server capacity (weight) with current active connections.

Scoring formula:
    score = active_connections / weight

The server with the LOWEST score is selected.  A lower score means
the server has more spare capacity relative to its weight.

Example:
    Server A: weight=5, conns=10 → score = 2.0
    Server B: weight=3, conns=3  → score = 1.0   ← selected
    Server C: weight=1, conns=0  → score = 0.0   ← even better

Ties are broken by server order.
"""
from __future__ import annotations
from typing import Optional
from app.models import ServerInfo


class WeightedLeastConnections:
    """Weighted least-connections selector."""

    @staticmethod
    def compute_score(server: ServerInfo) -> float:
        """
        score = active_connections / weight
        Lower is better — means more spare capacity.
        """
        if server.weight <= 0:
            return float("inf")
        return server.active_connections / server.weight

    def select(self, servers: list[ServerInfo]) -> Optional[ServerInfo]:
        if not servers:
            return None
        return min(servers, key=self.compute_score)

    def reset(self) -> None:
        pass  # no internal state
