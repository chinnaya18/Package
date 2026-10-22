/* ── App.tsx — main LoadFlow dashboard ── */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MetricCards } from './components/MetricCards';
import { ServerCard } from './components/ServerCard';
import { AlgorithmSelector } from './components/AlgorithmSelector';
import { TrafficGenerator } from './components/TrafficGenerator';
import { RequestFlow } from './components/RequestFlow';
import { RequestLogTable } from './components/RequestLog';
import { Charts } from './components/Charts';
import { AlgorithmComparison } from './components/AlgorithmComparison';
import { HowItWorks } from './components/HowItWorks';
import { stopServer, startServer } from './services/api';
import type { AlgorithmType, ServerInfo, OverallMetrics } from './types';
import { Activity, AlertTriangle } from 'lucide-react';

type Tab = 'dashboard' | 'comparison' | 'learn';

const DEFAULT_OVERALL: OverallMetrics = {
  total_requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  requests_per_second: 0,
  avg_response_time: 0,
  active_connections: 0,
  healthy_servers: 0,
  offline_servers: 0,
};

export default function App() {
  const { metrics, lastEvent, connected } = useWebSocket();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [overall, setOverall] = useState<OverallMetrics>(DEFAULT_OVERALL);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round_robin');
  const [trafficRunning, setTrafficRunning] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Response time history (last 20 data points)
  const [rtHistory, setRtHistory] = useState<{ time: string; [k: string]: number | string }[]>([]);
  const tickRef = useRef(0);

  // Update state from WS metrics
  useEffect(() => {
    if (!metrics) return;
    setServers(metrics.servers);
    setOverall(metrics.overall);
    setAlgorithm(metrics.algorithm);
    setTrafficRunning(metrics.traffic_running);
    setRefreshTrigger((n) => n + 1);

    // Build response time history data point
    tickRef.current += 1;
    const point: { time: string; [k: string]: number | string } = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    for (const s of metrics.servers) {
      point[s.server_id] = s.avg_response_time;
    }
    setRtHistory((prev) => {
      const next = [...prev, point];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, [metrics]);

  const handleStopServer = useCallback(async (id: string) => {
    try { await stopServer(id); } catch { /* */ }
  }, []);

  const handleStartServer = useCallback(async (id: string) => {
    try { await startServer(id); } catch { /* */ }
  }, []);

  const allOffline = overall.healthy_servers === 0 && servers.length > 0;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header" role="banner">
        <a href="/" className="app-header__logo" aria-label="LoadFlow Home">
          <div className="app-header__logo-icon">LF</div>
          LoadFlow
        </a>

        <nav className="app-header__nav" role="navigation" aria-label="Main navigation">
          <button
            className={`app-header__link ${tab === 'dashboard' ? 'app-header__link--active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`app-header__link ${tab === 'comparison' ? 'app-header__link--active' : ''}`}
            onClick={() => setTab('comparison')}
          >
            Compare
          </button>
          <button
            className={`app-header__link ${tab === 'learn' ? 'app-header__link--active' : ''}`}
            onClick={() => setTab('learn')}
          >
            How It Works
          </button>
        </nav>

        <div className="app-header__status" aria-live="polite">
          <span className={`app-header__dot ${connected ? '' : 'app-header__dot--disconnected'}`} />
          {connected ? 'Connected' : 'Reconnecting…'}
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        {/* Error banner */}
        {allOffline && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} />
            Service temporarily unavailable — no healthy backend servers.
          </div>
        )}

        {!connected && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} />
            Unable to connect to the load balancer. Make sure all services are running.
          </div>
        )}

        {/* Dashboard tab */}
        {tab === 'dashboard' && (
          <>
            <MetricCards metrics={overall} />

            <AlgorithmSelector current={algorithm} onChange={setAlgorithm} />

            <TrafficGenerator trafficRunning={trafficRunning} />

            {/* Two-column layout: servers + flow */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
              <div>
                <div className="section__header">
                  <h2 className="section__title">Backend Servers</h2>
                  <span className="section__subtitle">{servers.length} instances</span>
                </div>
                <div className="servers-grid">
                  {servers.map((s) => (
                    <ServerCard
                      key={s.server_id}
                      server={s}
                      onStop={handleStopServer}
                      onStart={handleStartServer}
                    />
                  ))}
                </div>
              </div>

              {/* Request Flow */}
              <div>
                <div className="section__header">
                  <h2 className="section__title">Request Flow</h2>
                </div>
                <RequestFlow servers={servers} lastEvent={lastEvent} algorithm={algorithm} />
              </div>
            </div>

            <div className="section">
              <div className="section__header">
                <h2 className="section__title">Live Charts</h2>
              </div>
              <Charts servers={servers} responseTimeHistory={rtHistory} />
            </div>

            <RequestLogTable refreshTrigger={refreshTrigger} />
          </>
        )}

        {/* Comparison tab */}
        {tab === 'comparison' && <AlgorithmComparison />}

        {/* Learn tab */}
        {tab === 'learn' && <HowItWorks />}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '16px 24px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        LoadFlow — Interactive Load Balancing &amp; Performance Monitoring Platform · Cloud Computing Project
      </footer>
    </div>
  );
}
