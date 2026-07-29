import { useEffect, useRef, useState } from "react";
import type { SensorReading } from "@/lib/api";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useLiveSensors(node: string) {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        if (!cancelled) setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const data: SensorReading = msg.data;
          if (data && data.node === node) {
            setReading(data);
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [node]);

  return { reading, status };
}
