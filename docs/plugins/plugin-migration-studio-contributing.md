---
description: How to contribute new Migration Studio tools and workflows using the catalog-driven architecture.
---

# Migration Studio Contributing

This guide explains how to add new tools and workflows to `@sbtools/plugin-migration-studio` using the current single-source catalog model.

## Architecture recap

Tool and workflow catalogs are discovery-driven:

- Tools are discovered from: `packages/plugin-migration-studio/src/tools/modules/*.tool.ts`
- Workflows are discovered from: `packages/plugin-migration-studio/src/workflows/*.workflow.ts`

Core implementation logic lives in:

- `packages/plugin-migration-studio/src/tools/core/*.core.ts`

CLI and HTTP wiring are generated from discovered tool definitions:

- `packages/plugin-migration-studio/src/index.ts`
- `packages/plugin-migration-studio/src/server.ts`

## Add a new tool

1. Create core logic:
   - `packages/plugin-migration-studio/src/tools/core/studio-<name>.core.ts`
2. Create tool module:
   - `packages/plugin-migration-studio/src/tools/modules/studio-<name>.tool.ts`
3. Export:
   - `tool` (`StudioToolDefinition`)
   - `metadata` (`ToolAudienceMetadata`)

Minimum tool module shape:

```ts
import { runMyTool } from "../core/studio-my-tool.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

export const tool: StudioToolDefinition<void, void> = {
  id: "studio-my-tool",
  async run(ctx) {
    await runMyTool(ctx);
  },
  cli: {
    command: "studio-my-tool",
    description: "Describe command",
    help: "help text...",
    parseArgs: () => undefined,
  },
  http: {
    method: "POST",
    path: "/api/studio/my-tool",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "My Tool",
  whatItDoes: "Plain-English behavior summary.",
  whenToUse: "When this tool should be used.",
  whatItNeeds: ["input A", "input B"],
  whatItProduces: ["artifact X"],
  audience: "backend-dev",
  controlModes: ["managed", "assisted"],
};
```

Notes:

- `cli.aliases` is optional for backward-compatible command aliases.
- `audience` and `controlModes` power persona/mode filtering in `studio-catalog` and `/api/studio/catalog`.

## Add a new workflow

1. Create file:
   - `packages/plugin-migration-studio/src/workflows/<name>.workflow.ts`
2. Export a `workflow` object of type `StudioWorkflowDefinition`.
3. Reference existing tool IDs in workflow steps.

Example:

```ts
import type { WorkflowStep } from "@sbtools/sdk";
import type { StudioWorkflowDefinition } from "./workflow-definition.js";

const steps: WorkflowStep[] = [
  {
    id: "my-step",
    tool: "studio-my-tool",
    inputArtifacts: [],
    outputArtifact: { id: "artifact.my", version: "1.0.0" },
  },
];

export const workflow: StudioWorkflowDefinition = {
  id: "my-workflow",
  description: "One-line workflow purpose",
  steps,
};
```

## Validation checklist

Run:

```bash
npm run build -w packages/plugin-migration-studio
npm run test -w packages/plugin-migration-studio
npm run test:e2e -w packages/plugin-migration-studio
```

Recommended tests:

- Tool unit tests under `packages/plugin-migration-studio/tests/tools/`
- Workflow/catalog tests under `packages/plugin-migration-studio/tests/workflows/`
- DB-aware e2e tests under `packages/plugin-migration-studio/tests/e2e/`

DB-backed e2e behavior:

- If DB is unavailable, tests should warn and skip DB-dependent flows.
- Start local stack with `sbt start` to run full DB-dependent e2e paths.
- Set `SBT_STUDIO_E2E_REQUIRE_DB=1` to fail fast instead of warning+skip when DB is unavailable.

## Catalog surfaces for contributors

- CLI:
  - `sbt studio-catalog --type all`
  - `sbt studio-catalog --audience backend-dev --mode managed`
- HTTP:
  - `GET /api/studio/catalog?type=all`
  - `GET /api/studio/catalog?audience=business&mode=assisted`

Use these to confirm your new tool/workflow appears with expected metadata.
