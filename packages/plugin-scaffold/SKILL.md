# @sbt/plugin-scaffold

Plugin that scaffolds new supabase-tools plugins. Lives in `supabase-tools/packages/plugin-scaffold/`.

## When to Use

Use this plugin when the user needs to:
- Create a new internal or external plugin
- Get consistent boilerplate (package.json, tsconfig, README, SKILL, SbtPlugin structure)
- Start with Atlas hook stubs (getAtlasData, getAtlasUI, getStatusLines, getOpenApiSpec)

## CLI Commands

- `sbt scaffold-plugin <name>` — Create internal plugin at `packages/plugin-<name>/`
- `sbt scaffold-plugin <name> --external` — Create external plugin at `supabase-tools-<name>-plugin/`
- `sbt scaffold-plugin <name> --hooks` — Include stub implementations of all Atlas hooks

## Configuration

None.

## File Layout

```
plugin-scaffold/
├── src/index.ts         # SbtPlugin with scaffold-plugin command
└── templates/           # package-json, tsconfig, index-ts, readme-md, skill-md, root-index-ts
```
