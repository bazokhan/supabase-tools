import { useEffect, useState, useCallback } from "react";

export interface ServiceItem {
  service: string;
  container: string;
  running: boolean;
  status: string;
}

export interface UiEndpoint {
  id: string;
  label: string;
  url: string;
  source: string;
  reachable: boolean;
}

export function useServices() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [uiEndpoints, setUiEndpoints] = useState<UiEndpoint[]>([]);
  const [docsSpecPresent, setDocsSpecPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() =>
    fetch("/api/services")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load services: ${r.status}`);
        return r.json() as Promise<{
          services: ServiceItem[];
          uis: { docsSpecPresent: boolean; items: UiEndpoint[] };
        }>;
      })
      .then((payload) => {
        setServices(payload.services ?? []);
        setUiEndpoints(payload.uis?.items ?? []);
        setDocsSpecPresent(Boolean(payload.uis?.docsSpecPresent));
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false)), []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { services, uiEndpoints, docsSpecPresent, loading, error, refresh };
}
