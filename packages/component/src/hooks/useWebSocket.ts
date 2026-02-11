import { useEffect, useRef, useCallback, useState } from "react";

interface UseWebSocketOptions {
  url: string;
  onJsonMessage: (data: any) => void;
  onBinaryMessage: (data: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useWebSocket({
  url,
  onJsonMessage,
  onBinaryMessage,
  onOpen,
  onClose,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000;
      onOpen?.();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onBinaryMessage(event.data);
      } else {
        try {
          onJsonMessage(JSON.parse(event.data));
        } catch {
          // ignore parse errors
        }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onClose?.();
      // Auto-reconnect with exponential backoff
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    wsRef.current = ws;
  }, [url, onJsonMessage, onBinaryMessage, onOpen, onClose]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendBinary = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { connected, sendBinary };
}
