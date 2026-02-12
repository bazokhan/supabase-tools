import type { SnapshotMeta } from "@sbtools/sdk";

/**
 * Builds the _meta/README.md content for the snapshot.
 *
 * @param meta - Snapshot metadata (timestamp, database_url, postgres_version).
 * @returns README.md content string.
 */
export function formatReadme(meta: SnapshotMeta): string {
  return `# Generated Database Snapshot

This directory contains a snapshot of the current database state, generated automatically from the live database.

## Contents

- **functions/** - Database functions (stored procedures)
- **views/** - Regular and materialized views
- **triggers/** - Database triggers
- **policies/** - Row-Level Security (RLS) policies
- **types/** - Custom composite types and domains
- **enums/** - Custom enum types

## Regeneration

To regenerate this snapshot, run:

\`\`\`bash
npm run db:snapshot
\`\`\`

## Important

- **Do not edit these files manually** - they are auto-generated
- Files are regenerated from the current database state
- Use this for reference and searching, not as source of truth
- The actual source of truth is in \`supabase/migrations/\`

## Metadata

See \`_meta/snapshot.json\` for:
- Generation timestamp
- Database connection info (sanitized)
- PostgreSQL version
- Object counts per category

## Usage

Use your IDE's search functionality to find specific:
- Function names
- View definitions
- Trigger logic
- RLS policy rules
- Type/enum definitions

Generated: ${meta.timestamp}
Database: ${meta.database_url}
PostgreSQL: ${meta.postgres_version}
`;
}
