# Getting Started

## Installation

```bash
# Install the core CLI
npm install @sbtools/core

# Install plugins you need (examples)
npm install @sbtools/plugin-erd
npm install @sbtools/plugin-deno-functions
npm install @sbtools/plugin-logs
```

## Configuration

Create `supabase-tools.config.json` at your project root (or run `npx sbt init`):

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": {} },
    { "path": "@sbtools/plugin-deno-functions", "config": {} }
  ]
}
```

You can use either:
- **npm package name** — `"path": "@sbtools/plugin-erd"` (resolved from node_modules)
- **filesystem path** — `"path": "./local-plugins/my-plugin"` (for local development)

## Quick Run

```bash
# Start Supabase Docker services
npx sbt start

# Check status
npx sbt status

# Run migrations
npx sbt migrate

# Generate ERD diagrams
npx sbt generate-erd
```

## Requirements

- Node.js 18+
- Docker (for `start`, `migrate`, `docs`)
