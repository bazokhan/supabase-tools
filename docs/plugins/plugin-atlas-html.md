---
description: atlas-html removed — use sbt dashboard instead.
---

# atlas-html (Removed)

The `atlas-html` command has been removed. Use **`sbt dashboard`** instead for the Backend Atlas visualization and all plugin UI contributions.

```bash
npx sbt generate-atlas   # First: generate backend-atlas-data.json
npx sbt dashboard         # Start the dashboard UI (port 3400)
```

The dashboard aggregates data from core extractors and plugins via `getDashboardView()` and `getAtlasData()`.
