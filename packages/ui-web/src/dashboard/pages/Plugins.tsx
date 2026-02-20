import React from "react";
import { Badge } from "../components/Badge";
import { useDashboardEvents } from "../hooks/useDashboardEvents";
import { usePlugins, type PluginItem } from "../hooks/usePlugins";

function statusRows(item: PluginItem): Array<{ label: string; tone: "good" | "warn" | "bad" | "default" }> {
  return [
    { label: item.configured ? "Configured" : "Not configured", tone: item.configured ? "good" : "warn" },
    { label: item.enabled ? "Enabled" : "Disabled", tone: item.enabled ? "good" : "warn" },
    { label: item.installed ? "Installed" : "Not installed", tone: item.installed ? "good" : "bad" },
    { label: item.loaded ? "Loaded" : "Reload dashboard needed", tone: item.loaded ? "good" : "default" },
  ];
}

export function PluginsPage() {
  const { plugins, loading, error, busyPlugin, act, refresh } = usePlugins();
  const [message, setMessage] = React.useState<string>("");

  const doAction = async (
    plugin: string,
    action: "add" | "remove" | "enable" | "disable",
    options?: { install?: boolean },
  ) => {
    try {
      const result = await act(plugin, action, options);
      const installLine = result.install?.attempted
        ? result.install.success
          ? " npm install completed."
          : ` npm install failed: ${result.install.error ?? "unknown error"}.`
        : "";
      setMessage(
        result.message +
        installLine +
        (result.restartRequired ? " Restart `sbt dashboard` to reload plugin runtime." : ""),
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  useDashboardEvents(
    React.useCallback((event) => {
      if (typeof event.type === "string" && event.type.startsWith("plugins:")) {
        refresh();
      }
    }, [refresh]),
  );

  if (loading) {
    return <section className="panel"><p className="empty-state">Loading plugins...</p></section>;
  }
  if (error) {
    return <section className="panel"><p className="empty-state">{error}</p></section>;
  }

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Plugin Manager</h2>
            <p>Configure, enable, and validate plugin readiness from the dashboard.</p>
          </div>
          <button type="button" className="btn" onClick={() => refresh()}>Refresh</button>
        </div>
        {message ? <p className="empty-state">{message}</p> : null}
      </section>

      <section className="panel plugin-grid">
        {plugins.map((item) => {
          const busy = busyPlugin === item.name;
          const canAdd = !item.configured;
          const canEnable = item.configured && !item.enabled;
          const canDisable = item.configured && item.enabled;
          const canRemove = item.configured;
          return (
            <article key={item.name} className="plugin-card">
              <div className="plugin-card-head">
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <Badge tone={item.builtin ? "accent" : "default"}>{item.source}</Badge>
              </div>
              <div className="cluster-row">
                {statusRows(item).map((status) => (
                  <Badge key={status.label} tone={status.tone}>{status.label}</Badge>
                ))}
              </div>
              {!item.installed ? <p className="plugin-install-hint"><code>npm install {item.name}</code></p> : null}
              <div className="plugin-actions">
                <button type="button" className="btn-primary-sm" disabled={!canAdd || busy} onClick={() => doAction(item.name, "add")}>Add</button>
                <button type="button" className="btn-primary-sm" disabled={!canAdd || busy || !item.name.startsWith("@")} onClick={() => doAction(item.name, "add", { install: true })}>Add + Install</button>
                <button type="button" className="btn-primary-sm" disabled={!canEnable || busy} onClick={() => doAction(item.name, "enable")}>Enable</button>
                <button type="button" className="btn" disabled={!canDisable || busy} onClick={() => doAction(item.name, "disable")}>Disable</button>
                <button type="button" className="btn-danger-sm" disabled={!canRemove || busy} onClick={() => doAction(item.name, "remove")}>Remove</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
