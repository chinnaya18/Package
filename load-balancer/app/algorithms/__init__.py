"""
LoadFlow — Load-Balancing Algorithm Modules

Each algorithm implements the same interface:
    select(servers: list[ServerInfo]) -> ServerInfo | None

`servers` contains only *healthy* servers.  The algorithm must never
return an unhealthy or empty result — callers handle the empty-list
case before calling.
"""
