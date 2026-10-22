"""
Weighted Round Robin Algorithm

Each server has a configurable weight.  Higher-weight servers receive
proportionally more requests.

Implementation: build a virtual schedule where each server appears
`weight` times, then iterate through that schedule.

Example with weights [5, 3, 1, 2]:
  Schedule = [S1,S1,S1,S1,S1, S2,S2,S2, S3, S4,S4]
  Total slots = 11  →  S1 gets ~45 %, S2 ~27 %, S3 ~9 %, S4 ~18 %
"""
from __future__ import annotations
from typing import Optional
from app.models import ServerInfo


class WeightedRoundRobin:
    """Weighted round-robin selector."""

    def __init__(self) -> None:
        self._index: int = 0
        self._schedule: list[str] = []  # server_ids in weighted order
        self._last_ids: list[str] = []  # track when pool changes

    def _rebuild_schedule(self, servers: list[ServerInfo]) -> None:
        """Rebuild the weighted schedule when the server pool changes."""
        self._schedule = []
        for s in servers:
            self._schedule.extend([s.server_id] * s.weight)
        self._last_ids = [s.server_id for s in servers]
        # Keep index valid
        if self._schedule:
            self._index = self._index % len(self._schedule)
        else:
            self._index = 0

    def select(self, servers: list[ServerInfo]) -> Optional[ServerInfo]:
        if not servers:
            return None

        current_ids = [s.server_id for s in servers]
        if current_ids != self._last_ids:
            self._rebuild_schedule(servers)

        if not self._schedule:
            return None

        self._index = self._index % len(self._schedule)
        selected_id = self._schedule[self._index]
        self._index = (self._index + 1) % len(self._schedule)

        # Find the ServerInfo object
        for s in servers:
            if s.server_id == selected_id:
                return s
        return servers[0]  # fallback

    def reset(self) -> None:
        self._index = 0
        self._schedule = []
        self._last_ids = []
