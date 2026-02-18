import { useState, useEffect } from "react";

export interface CommandInfo {
  name: string;
  description: string;
  category: string;
  source: "core" | string;
}

export function useCommands() {
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commands")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load commands: ${r.status}`);
        return r.json() as Promise<{ commands: CommandInfo[] }>;
      })
      .then((data) => setCommands(data.commands))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return { commands, loading, error };
}
