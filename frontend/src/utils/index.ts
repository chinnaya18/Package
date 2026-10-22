/* ── Utility helpers ── */

import type { ServerStatus } from '../types';

/** Format milliseconds into a readable string */
export function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Format uptime seconds */
export function formatUptime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Status indicator emoji + text */
export function statusIndicator(status: ServerStatus): { emoji: string; label: string; className: string } {
  switch (status) {
    case 'healthy':
      return { emoji: '🟢', label: 'Healthy', className: 'status-healthy' };
    case 'busy':
      return { emoji: '🟡', label: 'Busy', className: 'status-busy' };
    case 'unhealthy':
      return { emoji: '🔴', label: 'Unhealthy', className: 'status-unhealthy' };
    case 'offline':
      return { emoji: '⚫', label: 'Offline', className: 'status-offline' };
  }
}

/** Timestamp from ISO string */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

/** Clamp a number */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
