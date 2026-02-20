import { useEffect, useState, useCallback } from "react";

export interface PluginItem {
  name: string;
  description: string;
  builtin: boolean;
  configured: boolean;
  enabled: boolean;
  installed: boolean;
  loaded: boolean;
  source: "builtin" | "custom";
}

interface PluginActionResult {
  ok: boolean;
  changed: boolean;
  message: string;
  restartRequired: boolean;
  installHint?: string | null;
  install?: { attempted: boolean; success: boolean; output: string; error?: string };
}

export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPlugin, setBusyPlugin] = useState<string | null>(null);

  const refresh = useCallback(() =>
    fetch("/api/plugins")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load plugins: ${r.status}`);
        return r.json() as Promise<{ plugins: PluginItem[] }>;
      })
      .then((payload) => {
        setPlugins(payload.plugins ?? []);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false)), []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const act = async (
    plugin: string,
    action: "add" | "remove" | "enable" | "disable",
    options?: { install?: boolean },
  ): Promise<PluginActionResult> => {
    setBusyPlugin(plugin);
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugin, action, install: Boolean(options?.install) }),
      });
      const payload = (await res.json()) as PluginActionResult & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `Plugin action failed (${res.status})`);
      await refresh();
      return payload;
    } finally {
      setBusyPlugin(null);
    }
  };

  return { plugins, loading, error, busyPlugin, refresh, act };
}
