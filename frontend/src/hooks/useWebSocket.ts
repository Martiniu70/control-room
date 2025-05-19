// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from "react";

export function useWebSocket<T = any>(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;             // flag para saber se ainda estamos montados
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      if (!isMounted) return;
      console.log("WebSocket ligado");
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const json = JSON.parse(event.data) as T;
        setData(json);
      } catch (err) {
        console.error("Erro a parsear JSON do WS:", err);
      }
    };

    ws.current.onclose = () => {
      if (!isMounted) return;
      console.log("WebSocket fechado");
      setConnected(false);
    };

    ws.current.onerror = (err) => {
      if (!isMounted) return;
      console.error("Erro no WebSocket:", err);
      ws.current?.close();
    };

    return () => {
      // Cleanup: marca desmontagem e fecha socket
      isMounted = false;
      ws.current?.close();
    };
  }, [url]);

  return { data, connected };
}
