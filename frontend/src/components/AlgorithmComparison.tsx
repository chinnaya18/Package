/* ── AlgorithmComparison — run controlled tests and compare results ── */

import { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { runComparison } from '../services/api';
import { ALGORITHM_LABELS } from '../types';
import type { ComparisonResults } from '../types';
import { formatMs } from '../utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip, Legend, Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e'];
const REQUEST_OPTIONS = [50, 100, 200, 500];

export function AlgorithmComparison() {
  const [results, setResults] = useState<ComparisonResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalReqs, setTotalReqs] = useState(100);

  async function handleRun() {
    setLoading(true);
    try {
      const data = await runComparison(totalReqs);
      setResults(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Build chart data from results
  const chartData = results
    ? Object.entries(results).map(([key, r]) => ({
        algorithm: (ALGORITHM_LABELS as Record<string, string>)[key] || key,
        avg_response: r.avg_response_time,
        max_response: r.max_response_time,
        fairness: r.distribution_fairness,
        failed: r.failed,
      }))
    : [];

  return (
    <div className="section" role="region" aria-label="Algorithm comparison">
      <div className="section__header">
        <h2 className="section__title">Algorithm Comparison</h2>
      </div>

      <p className="section__subtitle" style={{ marginBottom: 16 }}>
        Run a controlled test with each algorithm and compare the results.
        Measurements are from the current simulation environment.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="traffic-panel__field">
          <span className="traffic-panel__label">Requests per algorithm</span>
          <div className="traffic-panel__options">
            {REQUEST_OPTIONS.map((n) => (
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
        <button
          className="btn btn--primary"
          onClick={handleRun}
          disabled={loading}
          aria-label="Run comparison test"
        >
          {loading ? <Loader2 size={14} className="spin" /> : <FlaskConical size={14} />}
          {loading ? 'Running…' : 'Run Comparison'}
        </button>
      </div>

      {results && (
        <>
          {/* Summary table */}
          <div className="comparison-table-container" style={{ marginBottom: 24 }}>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Successful</th>
                  <th>Failed</th>
                  <th>Avg Response</th>
                  <th>Max Response</th>
                  <th>Fairness</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([key, r]) => {
                  const label = (ALGORITHM_LABELS as Record<string, string>)[key] || key;
                  const fairnessColor =
                    r.distribution_fairness >= 80 ? 'var(--accent-green)' :
                    r.distribution_fairness >= 50 ? 'var(--accent-yellow)' :
                    'var(--accent-red)';
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</td>
                      <td>{r.successful}</td>
                      <td>{r.failed}</td>
                      <td>{formatMs(r.avg_response_time)}</td>
                      <td>{formatMs(r.max_response_time)}</td>
                      <td>
                        <div className="fairness-bar">
                          <span style={{ fontWeight: 700, color: fairnessColor }}>{r.distribution_fairness}%</span>
                          <div className="fairness-bar__track">
                            <div
                              className="fairness-bar__fill"
                              style={{ width: `${r.distribution_fairness}%`, backgroundColor: fairnessColor }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-server breakdown */}
          <div className="section__header" style={{ marginBottom: 12 }}>
            <h3 className="section__title" style={{ fontSize: '0.9375rem' }}>Per-Server Distribution</h3>
          </div>
          {Object.entries(results).map(([key, r]) => {
            const label = (ALGORITHM_LABELS as Record<string, string>)[key] || key;
            const data = r.servers.map((s) => ({
              name: s.server_id.replace('server-', 'S'),
              requests: s.requests,
            }));
            return (
              <div key={key} className="chart-card" style={{ marginBottom: 16 }}>
                <div className="chart-card__title">{label}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                    <XAxis dataKey="name" stroke="#6b7189" fontSize={12} />
                    <YAxis stroke="#6b7189" fontSize={12} />
                    <RTooltip
                      contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                      {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}

          {/* Comparison chart */}
          <div className="chart-card">
            <div className="chart-card__title">Response Time Comparison</div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                <XAxis dataKey="algorithm" stroke="#6b7189" fontSize={10} angle={-15} />
                <YAxis stroke="#6b7189" fontSize={12} unit=" ms" />
                <RTooltip
                  contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avg_response" name="Avg Response" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max_response" name="Max Response" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!results && !loading && (
        <div className="empty-state">
          <FlaskConical size={48} className="empty-state__icon" />
          <div className="empty-state__title">No comparison data yet</div>
          <div className="empty-state__text">
            Click "Run Comparison" to test all four algorithms and compare their performance.
          </div>
        </div>
      )}
    </div>
  );
}
