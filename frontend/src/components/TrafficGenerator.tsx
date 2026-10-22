/* ── TrafficGenerator — send simulated traffic ── */

import { useState } from 'react';
import { Play, Square, Send } from 'lucide-react';
import { sendRequest, startTraffic, stopTraffic } from '../services/api';

interface Props {
  trafficRunning: boolean;
}

const REQUEST_PRESETS = [10, 100, 500, 1000];
const RPS_PRESETS = [1, 10, 50, 100];

export function TrafficGenerator({ trafficRunning }: Props) {
  const [totalReqs, setTotalReqs] = useState(100);
  const [rps, setRps] = useState(10);
  const [sending, setSending] = useState(false);

  async function handleSingleRequest() {
    setSending(true);
    try {
      await sendRequest();
    } catch {
      // Error will be visible in logs
    } finally {
      setSending(false);
    }
  }

  async function handleStartTraffic() {
    try {
      await startTraffic(totalReqs, rps);
    } catch {
      // already running or error
    }
  }

  async function handleStopTraffic() {
    try {
      await stopTraffic();
    } catch {
      // ignore
    }
  }

  return (
    <div className="traffic-panel" role="region" aria-label="Traffic generator">
      <div className="section__header" style={{ marginBottom: 16 }}>
        <h2 className="section__title">Traffic Generator</h2>
        {trafficRunning && (
          <span style={{ color: 'var(--accent-green)', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="app-header__dot" /> Running
          </span>
        )}
      </div>

      <div className="traffic-panel__controls">
        {/* Single request button */}
        <button
          className="btn btn--primary"
          onClick={handleSingleRequest}
          disabled={sending}
          aria-label="Send single request"
        >
          <Send size={14} /> Send Request
        </button>

        {/* Total requests */}
        <div className="traffic-panel__field">
          <span className="traffic-panel__label">Requests</span>
          <div className="traffic-panel__options">
            {REQUEST_PRESETS.map((n) => (
              <button
                key={n}
                className={`traffic-opt ${totalReqs === n ? 'traffic-opt--active' : ''}`}
                onClick={() => setTotalReqs(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* RPS */}
        <div className="traffic-panel__field">
          <span className="traffic-panel__label">Requests/sec</span>
          <div className="traffic-panel__options">
            {RPS_PRESETS.map((n) => (
              <button
                key={n}
                className={`traffic-opt ${rps === n ? 'traffic-opt--active' : ''}`}
                onClick={() => setRps(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Start/Stop */}
        {trafficRunning ? (
          <button className="btn btn--danger" onClick={handleStopTraffic} aria-label="Stop traffic">
            <Square size={14} /> Stop Traffic
          </button>
        ) : (
          <button className="btn btn--success" onClick={handleStartTraffic} aria-label="Start traffic generation">
            <Play size={14} /> Start Traffic
          </button>
        )}
      </div>
    </div>
  );
}
