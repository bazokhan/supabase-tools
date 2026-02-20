import React from "react";
import { Badge } from "../components/Badge";
import { useDashboardEvents } from "../hooks/useDashboardEvents";
import { useCommands, type CommandInfo } from "../hooks/useCommands";

interface RunLogEntry {
  type: "stdout" | "stderr";
  line: string;
}

interface RunState {
  status: "idle" | "running" | "success" | "error";
  lines: RunLogEntry[];
  exitCode?: number;
}

type RunEvent =
  | { type: "start"; command: string; args?: string[]; pid: number }
  | { type: "stdout" | "stderr"; line: string }
  | { type: "exit"; code: number; success: boolean };

function runKey(command: string, args: string[] = []): string {
  return `${command}::${args.join("\u0001")}`;
}

function groupByCategory(commands: CommandInfo[]): Array<{ category: string; commands: CommandInfo[] }> {
  const map = new Map<string, CommandInfo[]>();
  for (const cmd of commands) {
    const group = map.get(cmd.category) ?? [];
    group.push(cmd);
    map.set(cmd.category, group);
  }
  return Array.from(map.entries()).map(([category, cmds]) => ({ category, commands: cmds }));
}

export function RunnerPage() {
  const { commands, loading, error, refresh } = useCommands();
  const [runStates, setRunStates] = React.useState<Map<string, RunState>>(new Map());
  const eventSourcesRef = React.useRef<Map<string, EventSource>>(new Map());
  const logRefsMap = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const getState = (key: string): RunState =>
    runStates.get(key) ?? { status: "idle", lines: [] };

  const patchState = (key: string, patch: Partial<RunState> | ((prev: RunState) => RunState)) => {
    setRunStates((prev) => {
      const next = new Map(prev);
      const current = prev.get(key) ?? { status: "idle", lines: [] };
      next.set(key, typeof patch === "function" ? patch(current) : { ...current, ...patch });
      return next;
    });
  };

  const scrollToBottom = (key: string) => {
    setTimeout(() => {
      const el = logRefsMap.current.get(key);
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  };

  const runCommand = (name: string, args: string[] = []) => {
    const commandInfo = commands.find((item) => item.name === name);
    const key = runKey(name, args);
    if (!commandInfo?.canRun) {
      patchState(key, (prev) => ({
        ...prev,
        status: "error",
        exitCode: 1,
        lines: [...prev.lines, { type: "stderr", line: commandInfo?.blockedReason ?? "Command is currently blocked." }],
      }));
      return;
    }
    eventSourcesRef.current.get(key)?.close();
    eventSourcesRef.current.delete(key);
    patchState(key, { status: "running", lines: [], exitCode: undefined });

    const es = new EventSource(`/api/run/stream?command=${encodeURIComponent(name)}&args=${encodeURIComponent(JSON.stringify(args))}`);
    eventSourcesRef.current.set(key, es);

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RunEvent;
        if (data.type === "exit") {
          es.close();
          eventSourcesRef.current.delete(key);
          patchState(key, (prev) => ({
            ...prev,
            status: data.success ? "success" : "error",
            exitCode: data.code,
          }));
          refresh();
        } else if (data.type === "stdout" || data.type === "stderr") {
          patchState(key, (prev) => ({
            ...prev,
            lines: [...prev.lines, { type: data.type as "stdout" | "stderr", line: data.line }],
          }));
          scrollToBottom(key);
        }
      } catch {
        // Ignore malformed event
      }
    };

    es.onerror = () => {
      es.close();
      eventSourcesRef.current.delete(key);
      patchState(key, (prev) => ({
        ...prev,
        status: "error",
        exitCode: 1,
        lines: [...prev.lines, { type: "stderr", line: "Connection lost." }],
      }));
      refresh();
    };
  };

  const stopCommand = (name: string, args: string[] = []) => {
    const key = runKey(name, args);
    fetch("/api/run/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: name, args }),
    }).catch(() => undefined);
    eventSourcesRef.current.get(key)?.close();
    eventSourcesRef.current.delete(key);
    patchState(key, (prev) => ({
      ...prev,
      status: "idle",
      lines: [...prev.lines, { type: "stderr", line: "Stop requested." }],
    }));
    refresh();
  };

  React.useEffect(() => {
    const sources = eventSourcesRef.current;
    return () => {
      for (const es of sources.values()) es.close();
    };
  }, []);

  useDashboardEvents(
    React.useCallback((event) => {
      if (event.type === "command:started" || event.type === "command:finished" || event.type === "command:stopping") {
        refresh();
      }
    }, [refresh]),
  );

  if (loading) {
    return (
      <section className="panel">
        <p className="empty-state">Loading commands...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <p className="empty-state">{error}</p>
      </section>
    );
  }

  const groups = groupByCategory(commands);

  return (
    <div className="runner-page">
      {groups.map(({ category, commands: cmds }) => (
        <section key={category} className="panel runner-category">
          <h3 className="runner-category-title">{category}</h3>
          <div className="runner-command-list">
            {cmds.map((cmd) => {
              const primaryArgs = cmd.variants[0]?.args ?? [];
              const key = runKey(cmd.name, primaryArgs);
              const state = getState(key);
              const isRunning = state.status === "running" || Boolean(cmd.running);
              const hasOutput = state.lines.length > 0;
              const isDestructive = cmd.name === "migrate" || cmd.name.includes("apply");
              const isLongRunning = cmd.longRunning;
              const disabledReason = cmd.blockedReason;

              return (
                <div
                  key={cmd.name}
                  className={`run-card${hasOutput || state.status !== "idle" ? " run-card--active" : ""}`}
                >
                  <div className="run-card-header">
                    <div className="run-card-info">
                      <div className="run-card-name-row">
                        <code className="run-cmd-name">{cmd.name}</code>
                        {isDestructive && <Badge tone="warn">Modifies DB</Badge>}
                        {isLongRunning && <Badge tone="default">Runs until cancelled</Badge>}
                        {cmd.running && <Badge tone="accent">Active pid {cmd.running.pid}</Badge>}
                        {cmd.missingPlugins.length > 0 && <Badge tone="warn">Plugin required</Badge>}
                        {cmd.missingServices.length > 0 && <Badge tone="warn">Service required</Badge>}
                      </div>
                      <p className="run-card-desc">{cmd.description}</p>
                      {disabledReason ? <p className="run-card-desc run-card-warning">{disabledReason}</p> : null}
                    </div>

                    <div className="run-card-actions">
                      {state.status !== "idle" && (
                        <span className={`run-status-pill run-status-${state.status}`}>
                          {state.status === "running" && "Running…"}
                          {state.status === "success" && `✓ Exit ${state.exitCode}`}
                          {state.status === "error" && `✗ Exit ${state.exitCode ?? 1}`}
                        </span>
                      )}
                      {isRunning && cmd.supportsStop ? (
                        <button type="button" className="btn-danger-sm" onClick={() => stopCommand(cmd.name, cmd.running?.args ?? primaryArgs)}>
                          Stop
                        </button>
                      ) : (
                        <button type="button" className="btn-primary-sm" onClick={() => runCommand(cmd.name, primaryArgs)} disabled={!cmd.canRun}>
                          Run ▶
                        </button>
                      )}
                    </div>
                  </div>

                  {cmd.variants.length > 1 && (
                    <div className="run-card-variants">
                      {cmd.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          className="btn"
                          onClick={() => runCommand(cmd.name, variant.args)}
                          disabled={!cmd.canRun && variant.args[0] !== "stop"}
                        >
                          {variant.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {hasOutput && (
                    <div
                      className="run-log-surface"
                      ref={(el) => {
                        if (el) logRefsMap.current.set(key, el);
                        else logRefsMap.current.delete(key);
                      }}
                    >
                      {state.lines.map((entry, i) => (
                        <div
                          key={i}
                          className={`run-log-line${entry.type === "stderr" ? " run-log-line--err" : ""}`}
                        >
                          {entry.line}
                        </div>
                      ))}
                      {isRunning && <div className="run-log-line run-log-cursor" aria-hidden>▋</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
