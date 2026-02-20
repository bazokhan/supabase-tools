import { useEffect } from "react";

type EventHandler = (event: { type?: string; [key: string]: unknown }) => void;

export function useDashboardEvents(onEvent: EventHandler) {
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { type?: string; [key: string]: unknown };
        onEvent(payload);
      } catch {
        // ignore malformed event payloads
      }
    };
    source.onerror = () => {
      // native EventSource reconnect handles retry automatically
    };
    return () => source.close();
  }, [onEvent]);
}
