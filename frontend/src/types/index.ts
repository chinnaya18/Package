/* ── Types shared across the LoadFlow frontend ── */

export type ServerStatus = 'healthy' | 'busy' | 'unhealthy' | 'offline';

export type AlgorithmType =
  | 'round_robin'
  | 'weighted_round_robin'
  | 'least_connections'
  | 'weighted_least_connections';

export interface ServerInfo {
  server_id: string;
  url: string;
  status: ServerStatus;
  weight: number;
  active_connections: number;
  total_requests: number;
  avg_response_time: number;
  requests_per_second: number;
  application_load: number;
  uptime_seconds: number;
  enabled: boolean;
}

export interface OverallMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  requests_per_second: number;
  avg_response_time: number;
  active_connections: number;
  healthy_servers: number;
  offline_servers: number;
}

export interface MetricsPayload {
  type: 'metrics';
  servers: ServerInfo[];
  algorithm: AlgorithmType;
  overall: OverallMetrics;
  traffic_running: boolean;
}

export interface RequestRoutedEvent {
  type: 'request_routed';
  request_id: string;
  server_id: string;
  algorithm: AlgorithmType;
  response_time: number;
  status: 'success' | 'failed';
}

export interface RequestLog {
  timestamp: string;
  request_id: string;
  algorithm: string;
  server_id: string;
  response_time: number;
  status: string;
}

export interface ComparisonServerResult {
  server_id: string;
  requests: number;
  failed: number;
  avg_response_time: number;
  max_response_time: number;
}

export interface ComparisonResult {
  algorithm: string;
  total_requests: number;
  successful: number;
  failed: number;
  avg_response_time: number;
  max_response_time: number;
  distribution_fairness: number;
  servers: ComparisonServerResult[];
}

export type ComparisonResults = Record<string, ComparisonResult>;

export const ALGORITHM_LABELS: Record<AlgorithmType, string> = {
  round_robin: 'Round Robin',
  weighted_round_robin: 'Weighted Round Robin',
  least_connections: 'Least Connections',
  weighted_least_connections: 'Weighted Least Connections',
};

export const ALGORITHM_DESCRIPTIONS: Record<AlgorithmType, string> = {
  round_robin: 'Distributes requests sequentially across servers in order.',
  weighted_round_robin: 'Like Round Robin but higher-weight servers receive proportionally more requests.',
  least_connections: 'Routes to the server with the fewest active connections.',
  weighted_least_connections: 'Combines weight and active connections. Score = connections / weight; lowest wins.',
};

export const STATUS_COLORS: Record<ServerStatus, string> = {
  healthy: '#22c55e',
  busy: '#eab308',
  unhealthy: '#ef4444',
  offline: '#6b7280',
};

export const SERVER_DISPLAY_NAMES: Record<string, string> = {
  'server-1': 'Server 1',
  'server-2': 'Server 2',
  'server-3': 'Server 3',
  'server-4': 'Server 4',
};
