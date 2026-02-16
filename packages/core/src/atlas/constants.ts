/**
 * Emits the JS constants block: DATA_URL, state object, kindLabels map.
 */
export function emitConstants(pluginKindLabels: Record<string, string>): string {
  const coreKinds = [
    "function",
    "policy",
    "trigger",
    "view",
    "materialized_view",
    "type",
    "enum",
  ];
  const allKinds = [...coreKinds, ...Object.keys(pluginKindLabels)];
  const kindsSetEntries = allKinds.map((k) => `        "${k}"`).join(",\n");

  const coreLabels: Record<string, string> = {
    function: "Functions",
    policy: "RLS Policies",
    trigger: "Triggers",
    view: "Views",
    materialized_view: "Materialized Views",
    type: "Types",
    enum: "Enums",
  };
  const merged = { ...coreLabels, ...pluginKindLabels };
  const labelEntries = Object.entries(merged)
    .map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");

  return `    const DATA_URL = "./backend-atlas-data.json";

    const state = {
      search: "",
      schema: "all",
      activeKinds: new Set([
${kindsSetEntries}
      ]),
    };

    const kindLabels = {
${labelEntries}
    };`;
}
