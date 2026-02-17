import { useState, useEffect } from "react";
import type { DashboardSectionDef } from "@sbtools/sdk";

const DEFAULT_BASE = "";

export function useDashboardConfig(base = DEFAULT_BASE) {
  const [sections, setSections] = useState<DashboardSectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `${base}/api/dashboard-config`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load dashboard config: ${r.status}`);
        return r.json();
      })
      .then((json) => setSections(json.sections ?? []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [base]);

  return { sections, loading, error };
}
