/* ── RequestLog — live scrolling request log table with filters ── */

import { useEffect, useState, useCallback } from 'react';
import { Trash2, Search } from 'lucide-react';
import { fetchLogs, clearLogs } from '../services/api';
import { formatTime, formatMs } from '../utils';
import type { RequestLog as RequestLogType } from '../types';

interface Props {
  /** Trigger a refresh whenever this value changes */
  refreshTrigger: number;
}

export function RequestLogTable({ refreshTrigger }: Props) {
  const [logs, setLogs] = useState<RequestLogType[]>([]);
  const [serverFilter, setServerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchLogs({
        server: serverFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        limit: 200,
      });
      setLogs(data);
    } catch {
      // ignore
    }
  }, [serverFilter, statusFilter, search]);

  // Poll logs every 2 seconds
  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load, refreshTrigger]);

  async function handleClear() {
    await clearLogs();
    setLogs([]);
  }

  return (
    <div className="section" role="region" aria-label="Request log">
      <div className="section__header">
        <h2 className="section__title">Request Log</h2>
        <button className="btn btn--ghost btn--sm" onClick={handleClear} aria-label="Clear all logs">
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
          <input
            className="filter-input"
            placeholder="Search request ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search request ID"
            style={{ paddingLeft: 30 }}
          />
        </div>

        <select
          className="filter-select"
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          aria-label="Filter by server"
        >
          <option value="">All Servers</option>
          <option value="server-1">Server 1</option>
          <option value="server-2">Server 2</option>
          <option value="server-3">Server 3</option>
          <option value="server-4">Server 4</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="log-table-container" style={{ maxHeight: 400, overflow: 'auto' }}>
        <table className="log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Request ID</th>
              <th>Algorithm</th>
              <th>Server</th>
              <th>Response Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No requests logged yet. Send a request to see it here.
                </td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <tr key={`${log.request_id}-${i}`}>
                  <td>{formatTime(log.timestamp)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.request_id}</td>
                  <td>{log.algorithm.replace(/_/g, ' ')}</td>
                  <td>{log.server_id === 'none' ? '—' : log.server_id.replace('server-', 'Server ')}</td>
                  <td>{formatMs(log.response_time)}</td>
                  <td className={`log-table__status--${log.status}`}>
                    {log.status.toUpperCase()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
