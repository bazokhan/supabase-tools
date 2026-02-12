# @sbtools/plugin-scaffold

Plugin for supabase-tools that scaffolds new plugins with consistent boilerplate matching established patterns.

## Quick Start

```bash
# Internal plugin (packages/plugin-<name>/)
npm run sbt -- scaffold-plugin analytics

# External plugin (supabase-tools-<name>-plugin/)
npm run sbt -- scaffold-plugin my-feature --external

# With Atlas hooks
npm run sbt -- scaffold-plugin dashboard --hooks
```

## Commands

| Command | Description |
|---------|-------------|
| `scaffold-plugin <name>` | Create internal plugin in packages/ |
| `scaffold-plugin <name> --external` | Create external plugin as sibling dir |
| `scaffold-plugin <name> --hooks` | Include Atlas hook stubs |

## Configuration

No config required.

## Project Structure

```
packages/plugin-scaffold/
├── src/
│   ├── index.ts           # SbtPlugin with scaffold-plugin command
│   └── templates/         # File generators
├── package.json
├── tsconfig.json
└── README.md
```
