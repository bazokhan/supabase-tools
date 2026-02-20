import { useState, useEffect, useCallback } from "react";
import type { DashboardSectionDef } from "@sbtools/sdk";

const DEFAULT_BASE = "";

export function useDashboardConfig(base = DEFAULT_BASE) {
  const [sections, setSections] = useState<DashboardSectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((v) => v + 1), []);

  useEffect(() => {
    setLoading(true);
    const url = `${base}/api/dashboard-config`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load dashboard config: ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setSections(json.sections ?? []);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [base, refreshToken]);

  return { sections, loading, error, refresh };
}
