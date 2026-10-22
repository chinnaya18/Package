/* ── RequestFlow — visual animation of request routing ── */

import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ServerInfo, RequestRoutedEvent, AlgorithmType } from '../types';
import { ALGORITHM_LABELS } from '../types';

interface Props {
  servers: ServerInfo[];
  lastEvent: RequestRoutedEvent | null;
  algorithm: AlgorithmType;
}

export function RequestFlow({ servers, lastEvent, algorithm }: Props) {
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [activeReq, setActiveReq] = useState<string | null>(null);

  useEffect(() => {
    if (lastEvent && lastEvent.type === 'request_routed') {
      setActiveServer(lastEvent.server_id);
      setActiveReq(lastEvent.request_id);
      const timer = setTimeout(() => {
        setActiveServer(null);
        setActiveReq(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  return (
    <div className="flow-viz" role="region" aria-label="Request flow visualization">
      <div className="flow-viz__nodes">
        {/* User node */}
        <div className={`flow-viz__node ${activeReq ? 'flow-viz__node--active' : ''}`}>
          👤 User
          {activeReq && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--accent-blue)', marginTop: 4 }}>
              {activeReq}
            </div>
          )}
        </div>

        <div className="flow-viz__arrow">
          <ArrowDown size={18} />
        </div>

        {/* Load Balancer */}
        <div className="flow-viz__node flow-viz__node--lb">
          ⚖️ Load Balancer
          <div style={{ fontSize: '0.6875rem', marginTop: 4, color: 'var(--text-muted)' }}>
            {ALGORITHM_LABELS[algorithm]}
          </div>
        </div>

        <div className="flow-viz__arrow">
          <ArrowDown size={18} />
        </div>

        {/* Server nodes */}
        <div className="flow-viz__servers">
          {servers.map((s) => {
            const isSelected = activeServer === s.server_id;
            const isOffline = s.status === 'offline' || s.status === 'unhealthy';
            return (
              <div
                key={s.server_id}
                className={`flow-viz__server ${isSelected ? 'flow-viz__server--selected' : ''} ${isOffline ? 'flow-viz__server--offline' : ''}`}
              >
                {s.server_id.replace('server-', 'S')}
                {isSelected && (
                  <div style={{ fontSize: '0.625rem', marginTop: 2 }}>← routed</div>
                )}
                {isOffline && (
                  <div style={{ fontSize: '0.625rem', marginTop: 2 }}>offline</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {lastEvent && (
        <div className="flow-viz__info" aria-live="polite">
          Last: {lastEvent.request_id} → {lastEvent.server_id.replace('server-', 'Server ')} ({lastEvent.response_time.toFixed(0)} ms)
        </div>
      )}
    </div>
  );
}
