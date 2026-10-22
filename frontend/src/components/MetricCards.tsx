/* ── MetricCards — overall system metrics ── */

import { Activity, CheckCircle, XCircle, Zap, Clock, Link2, Server, ServerOff } from 'lucide-react';
import type { OverallMetrics } from '../types';
import { formatMs } from '../utils';
import { Tooltip } from './Tooltip';

interface Props {
  metrics: OverallMetrics;
}

const cards = (m: OverallMetrics) => [
  { label: 'Total Requests', value: m.total_requests.toLocaleString(), icon: Activity, tooltip: 'Total number of requests routed through the load balancer' },
  { label: 'Successful', value: m.successful_requests.toLocaleString(), icon: CheckCircle, tooltip: 'Requests that received a successful response from a backend server' },
  { label: 'Failed', value: m.failed_requests.toLocaleString(), icon: XCircle, tooltip: 'Requests that failed due to server errors or unavailability' },
  { label: 'Requests/sec', value: m.requests_per_second.toString(), icon: Zap, tooltip: 'Current throughput measured in requests per second' },
  { label: 'Avg Response', value: formatMs(m.avg_response_time), icon: Clock, tooltip: 'Average end-to-end response time across all successful requests' },
  { label: 'Active Conns', value: m.active_connections.toString(), icon: Link2, tooltip: 'Number of currently open connections being processed by backend servers' },
  { label: 'Healthy', value: m.healthy_servers.toString(), icon: Server, tooltip: 'Number of backend servers currently passing health checks' },
  { label: 'Offline', value: m.offline_servers.toString(), icon: ServerOff, tooltip: 'Number of backend servers currently unreachable or disabled' },
];

export function MetricCards({ metrics }: Props) {
  return (
    <div className="metrics-grid" role="region" aria-label="Overall system metrics">
      {cards(metrics).map((c) => (
        <div className="metric-card" key={c.label}>
          <div className="metric-card__label">
            <c.icon size={14} />
            {c.label}
            <Tooltip text={c.tooltip} />
          </div>
          <div className="metric-card__value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
