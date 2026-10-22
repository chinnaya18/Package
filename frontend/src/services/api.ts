/* ── API service — all HTTP calls to the Load Balancer ── */

import axios from 'axios';
import type {
  AlgorithmType,
  ComparisonResults,
  RequestLog,
  ServerInfo,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

/* ── Servers ── */

export async function fetchServers(): Promise<ServerInfo[]> {
  const { data } = await api.get<ServerInfo[]>('/servers');
  return data;
}

export async function fetchServer(id: string): Promise<ServerInfo> {
  const { data } = await api.get<ServerInfo>(`/servers/${id}`);
  return data;
}

export async function stopServer(id: string): Promise<void> {
  await api.post(`/servers/${id}/stop`);
}

export async function startServer(id: string): Promise<void> {
  await api.post(`/servers/${id}/start`);
}

export async function updateServerWeight(
  id: string,
  weight: number
): Promise<void> {
  await api.put(`/servers/${id}/weight`, { weight });
}

/* ── Algorithm ── */

export async function fetchAlgorithm(): Promise<AlgorithmType> {
  const { data } = await api.get<{ algorithm: AlgorithmType }>('/algorithm');
  return data.algorithm;
}

export async function setAlgorithm(algorithm: AlgorithmType): Promise<void> {
  await api.post('/algorithm', { algorithm });
}

/* ── Requests ── */

export async function sendRequest(): Promise<Record<string, unknown>> {
  const { data } = await api.post('/request');
  return data;
}

/* ── Traffic ── */

export async function startTraffic(
  totalRequests: number,
  rps: number
): Promise<void> {
  await api.post('/traffic/start', {
    total_requests: totalRequests,
    requests_per_second: rps,
  });
}

export async function stopTraffic(): Promise<void> {
  await api.post('/traffic/stop');
}

/* ── Logs ── */

export async function fetchLogs(params?: {
  server?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<RequestLog[]> {
  const { data } = await api.get<RequestLog[]>('/logs', { params });
  return data;
}

export async function clearLogs(): Promise<void> {
  await api.post('/logs/clear');
}

/* ── Comparison ── */

export async function runComparison(
  totalRequests: number
): Promise<ComparisonResults> {
  const { data } = await api.post<ComparisonResults>('/test', {
    total_requests: totalRequests,
  });
  return data;
}

/* ── Health ── */

export async function fetchHealth(): Promise<{
  status: string;
  servers: number;
  healthy: number;
}> {
  const { data } = await api.get('/health');
  return data;
}
