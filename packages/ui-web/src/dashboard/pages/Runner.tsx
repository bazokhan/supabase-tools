import React from "react";
import { Badge } from "../components/Badge";
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
  | { type: "start"; command: string; pid: number }
  | { type: "stdout" | "stderr"; line: string }
  | { type: "exit"; code: number; success: boolean };

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
  const { commands, loading, error } = useCommands();
  const [runStates, setRunStates] = React.useState<Map<string, RunState>>(new Map());
  const eventSourcesRef = React.useRef<Map<string, EventSource>>(new Map());
  const logRefsMap = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const getState = (name: string): RunState =>
    runStates.get(name) ?? { status: "idle", lines: [] };

  const patchState = (name: string, patch: Partial<RunState> | ((prev: RunState) => RunState)) => {
    setRunStates((prev) => {
      const next = new Map(prev);
      const current = prev.get(name) ?? { status: "idle", lines: [] };
      next.set(name, typeof patch === "function" ? patch(current) : { ...current, ...patch });
      return next;
    });
  };

  const scrollToBottom = (name: string) => {
    setTimeout(() => {
      const el = logRefsMap.current.get(name);
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  };

  const runCommand = (name: string) => {
    const commandInfo = commands.find((item) => item.name === name);
    if (!commandInfo?.canRun) {
      patchState(name, (prev) => ({
        ...prev,
        status: "error",
        exitCode: 1,
        lines: [...prev.lines, { type: "stderr", line: commandInfo?.blockedReason ?? "Command is currently blocked." }],
      }));
      return;
    }
    eventSourcesRef.current.get(name)?.close();
    eventSourcesRef.current.delete(name);
    patchState(name, { status: "running", lines: [], exitCode: undefined });

    const es = new EventSource(`/api/run/stream?command=${encodeURIComponent(name)}`);
    eventSourcesRef.current.set(name, es);

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RunEvent;
        if (data.type === "exit") {
          es.close();
          eventSourcesRef.current.delete(name);
          patchState(name, (prev) => ({
            ...prev,
            status: data.success ? "success" : "error",
            exitCode: data.code,
          }));
        } else if (data.type === "stdout" || data.type === "stderr") {
          patchState(name, (prev) => ({
            ...prev,
            lines: [...prev.lines, { type: data.type as "stdout" | "stderr", line: data.line }],
          }));
          scrollToBottom(name);
        }
      } catch {
        // Ignore malformed event
      }
    };

    es.onerror = () => {
      es.close();
      eventSourcesRef.current.delete(name);
      patchState(name, (prev) => ({
        ...prev,
        status: "error",
        exitCode: 1,
        lines: [...prev.lines, { type: "stderr", line: "Connection lost." }],
      }));
    };
  };

  const cancelCommand = (name: string) => {
    eventSourcesRef.current.get(name)?.close();
    eventSourcesRef.current.delete(name);
    patchState(name, (prev) => ({
      ...prev,
      status: "idle",
      lines: [...prev.lines, { type: "stderr", line: "Cancelled." }],
    }));
  };

  React.useEffect(() => {
    const sources = eventSourcesRef.current;
    return () => {
      for (const es of sources.values()) es.close();
    };
  }, []);

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
              const state = getState(cmd.name);
              const isRunning = state.status === "running";
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
                      {isRunning ? (
                        <button type="button" className="btn-danger-sm" onClick={() => cancelCommand(cmd.name)}>
                          Cancel
                        </button>
                      ) : (
                        <button type="button" className="btn-primary-sm" onClick={() => runCommand(cmd.name)} disabled={!cmd.canRun}>
                          Run ▶
                        </button>
                      )}
                    </div>
                  </div>

                  {hasOutput && (
                    <div
                      className="run-log-surface"
                      ref={(el) => {
                        if (el) logRefsMap.current.set(cmd.name, el);
                        else logRefsMap.current.delete(cmd.name);
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
