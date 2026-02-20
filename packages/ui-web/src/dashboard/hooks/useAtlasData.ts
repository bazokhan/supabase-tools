import { useState, useEffect, useCallback } from "react";

export interface AtlasData {
  meta?: { timestamp?: string; database_url?: string; postgres_version?: string; object_counts?: Record<string, number> };
  schemas?: string[];
  categories?: Record<string, unknown[]>;
}

const DEFAULT_BASE = "";

export function useAtlasData(base = DEFAULT_BASE) {
  const [data, setData] = useState<AtlasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((v) => v + 1), []);

  useEffect(() => {
    setLoading(true);
    const url = `${base}/api/atlas-data`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load atlas data: ${r.status}`);
        return r.json();
      })
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [base, refreshToken]);

  return { data, loading, error, refresh };
}
