import { useState, useEffect } from "react";

export interface CommandInfo {
  name: string;
  description: string;
  category: string;
  source: "core" | string;
  requiresPlugins: string[];
  missingPlugins: string[];
  requiresServices: string[];
  missingServices: string[];
  longRunning: boolean;
  singleton: boolean;
  running: { command: string; pid: number; startedAt: string } | null;
  canRun: boolean;
  blockedReason: string | null;
}

export function useCommands() {
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/commands")
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load commands: ${r.status}`);
          return r.json() as Promise<{ commands: CommandInfo[] }>;
        })
        .then((data) => {
          if (!active) return;
          setCommands(data.commands);
          setError(null);
        })
        .catch((e) => {
          if (!active) return;
          setError((e as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    const interval = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { commands, loading, error };
}
