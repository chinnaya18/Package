/* ── ServerCard — individual server status card ── */

import { Power, PlayCircle, Minus, Plus } from 'lucide-react';
import type { ServerInfo } from '../types';
import { statusIndicator, formatMs, formatUptime } from '../utils';
import { updateServerWeight } from '../services/api';
import { Tooltip } from './Tooltip';

interface Props {
  server: ServerInfo;
  onStop: (id: string) => void;
  onStart: (id: string) => void;
}

export function ServerCard({ server, onStop, onStart }: Props) {
  const si = statusIndicator(server.status);
  const isOffline = server.status === 'offline' || server.status === 'unhealthy';

  const loadColor =
    server.application_load > 80
      ? 'var(--accent-red)'
      : server.application_load > 50
      ? 'var(--accent-yellow)'
      : 'var(--accent-green)';

  const displayName = server.server_id.replace('server-', 'Server ');

  async function adjustWeight(delta: number) {
    const newWeight = Math.max(1, Math.min(10, server.weight + delta));
    if (newWeight !== server.weight) {
      await updateServerWeight(server.server_id, newWeight);
    }
  }

  return (
    <div
      className={`server-card server-card--${server.status}`}
      role="article"
      aria-label={`${displayName} — ${si.label}`}
    >
      {/* Header */}
      <div className="server-card__header">
        <span className="server-card__name">{displayName}</span>
        <span className={`server-card__status server-card__status--${server.status}`} aria-live="polite">
          {si.emoji} {si.label}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="server-card__metrics">
        <div className="server-metric">
          <span className="server-metric__label">
            Application Load
            <Tooltip text="Simulated application load based on active connections and throughput. This is NOT real CPU usage." />
          </span>
          <span className="server-metric__value">{server.application_load.toFixed(1)}%</span>
          <div className="load-bar">
            <div
              className="load-bar__fill"
              style={{ width: `${server.application_load}%`, backgroundColor: loadColor }}
            />
          </div>
        </div>

        <div className="server-metric">
          <span className="server-metric__label">Active Conns</span>
          <span className="server-metric__value">{server.active_connections}</span>
        </div>

        <div className="server-metric">
          <span className="server-metric__label">Total Requests</span>
          <span className="server-metric__value">{server.total_requests.toLocaleString()}</span>
        </div>

        <div className="server-metric">
          <span className="server-metric__label">Avg Response</span>
          <span className="server-metric__value">{formatMs(server.avg_response_time)}</span>
        </div>

        <div className="server-metric">
          <span className="server-metric__label">Req/sec</span>
          <span className="server-metric__value">{server.requests_per_second}</span>
        </div>

        <div className="server-metric">
          <span className="server-metric__label">
            Weight
            <Tooltip text="Server capacity weight used by Weighted Round Robin and Weighted Least Connections algorithms." />
          </span>
          <div className="weight-editor">
            <button
              className="weight-editor__btn"
              onClick={() => adjustWeight(-1)}
              aria-label={`Decrease ${displayName} weight`}
              disabled={server.weight <= 1}
            >
              <Minus size={12} />
            </button>
            <span className="weight-editor__value">{server.weight}</span>
            <button
              className="weight-editor__btn"
              onClick={() => adjustWeight(1)}
              aria-label={`Increase ${displayName} weight`}
              disabled={server.weight >= 10}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Uptime */}
      <div className="server-metric" style={{ marginBottom: 12 }}>
        <span className="server-metric__label">Uptime</span>
        <span className="server-metric__value">{formatUptime(server.uptime_seconds)}</span>
      </div>

      {/* Actions */}
      <div className="server-card__actions">
        {isOffline ? (
          <button
            className="btn btn--success btn--full"
            onClick={() => onStart(server.server_id)}
            aria-label={`Start ${displayName}`}
          >
            <PlayCircle size={14} /> Start Server
          </button>
        ) : (
          <button
            className="btn btn--danger btn--full"
            onClick={() => onStop(server.server_id)}
            aria-label={`Stop ${displayName}`}
          >
            <Power size={14} /> Stop Server
          </button>
        )}
      </div>
    </div>
  );
}
