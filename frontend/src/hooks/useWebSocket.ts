/* ── useWebSocket — manages the live WebSocket connection to the LB ── */

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  MetricsPayload,
  RequestRoutedEvent,
} from '../types';

type WSMessage = MetricsPayload | RequestRoutedEvent | { type: string };

interface UseWebSocketReturn {
  metrics: MetricsPayload | null;
  lastEvent: RequestRoutedEvent | null;
  connected: boolean;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [lastEvent, setLastEvent] = useState<RequestRoutedEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data);
        if (msg.type === 'metrics') {
          setMetrics(msg as MetricsPayload);
        } else if (msg.type === 'request_routed') {
          setLastEvent(msg as RequestRoutedEvent);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeout.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { metrics, lastEvent, connected };
}
