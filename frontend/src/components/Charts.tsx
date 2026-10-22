/* ── Charts — Recharts visualizations ── */

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip, Legend,
  LineChart, Line, Cell,
} from 'recharts';
import type { ServerInfo } from '../types';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e'];

interface Props {
  servers: ServerInfo[];
  /** Historical response time data points */
  responseTimeHistory: { time: string; [key: string]: number | string }[];
}

export function Charts({ servers, responseTimeHistory }: Props) {
  const distributionData = useMemo(
    () =>
      servers.map((s) => ({
        name: s.server_id.replace('server-', 'S'),
        requests: s.total_requests,
      })),
    [servers]
  );

  const connectionsData = useMemo(
    () =>
      servers.map((s) => ({
        name: s.server_id.replace('server-', 'S'),
        connections: s.active_connections,
      })),
    [servers]
  );

  const loadData = useMemo(
    () =>
      servers.map((s) => ({
        name: s.server_id.replace('server-', 'S'),
        load: s.application_load,
      })),
    [servers]
  );

  return (
    <div className="charts-grid">
      {/* Request Distribution */}
      <div className="chart-card">
        <div className="chart-card__title">Request Distribution</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={distributionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
            <XAxis dataKey="name" stroke="#6b7189" fontSize={12} />
            <YAxis stroke="#6b7189" fontSize={12} />
            <RTooltip
              contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e8eaed' }}
            />
            <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
              {distributionData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Active Connections */}
      <div className="chart-card">
        <div className="chart-card__title">Active Connections</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={connectionsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
            <XAxis dataKey="name" stroke="#6b7189" fontSize={12} />
            <YAxis stroke="#6b7189" fontSize={12} />
            <RTooltip
              contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e8eaed' }}
            />
            <Bar dataKey="connections" radius={[4, 4, 0, 0]}>
              {connectionsData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Response Time Trend */}
      <div className="chart-card">
        <div className="chart-card__title">Response Time Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={responseTimeHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
            <XAxis dataKey="time" stroke="#6b7189" fontSize={11} />
            <YAxis stroke="#6b7189" fontSize={12} unit=" ms" />
            <RTooltip
              contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e8eaed' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {servers.map((s, i) => (
              <Line
                key={s.server_id}
                type="monotone"
                dataKey={s.server_id}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={s.server_id.replace('server-', 'S')}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Server Load */}
      <div className="chart-card">
        <div className="chart-card__title">Server Application Load</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={loadData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
            <XAxis dataKey="name" stroke="#6b7189" fontSize={12} />
            <YAxis stroke="#6b7189" fontSize={12} domain={[0, 100]} unit="%" />
            <RTooltip
              contentStyle={{ background: '#1c1f2e', border: '1px solid #2a2e3f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e8eaed' }}
              formatter={(value: any) => [`${Number(value ?? 0).toFixed(1)}%`, 'Load']}
            />
            <Bar dataKey="load" radius={[4, 4, 0, 0]}>
              {loadData.map((entry, i) => {
                const color =
                  entry.load > 80 ? '#ef4444' : entry.load > 50 ? '#eab308' : '#22c55e';
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
