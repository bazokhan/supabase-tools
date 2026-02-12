export function generateReadmeMd(name: string, external: boolean): string {
  const pkgName = `@sbtools/plugin-${name}`;
  const cmdName = name.replace(/-/g, "-");

  if (external) {
    return `# ${pkgName}

Plugin for [supabase-tools](../supabase-tools/) that adds ${name} functionality.

## Quick Start

\`\`\`bash
# Add to supabase-tools.config.json → plugins array
# Run the command
npx tsx supabase-tools/cli.ts ${cmdName}
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`${cmdName}\` | ${name} plugin command |

## Configuration

\`\`\`json
{
  "plugins": [
    {
      "path": "${pkgName}",
      "config": {}
    }
  ]
}
\`\`\`

## Project Structure

\`\`\`
plugin-${name}/
├── index.ts
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
\`\`\`
`;
  }

  return `# ${pkgName}

Plugin for supabase-tools that provides ${name} functionality.

## Quick Start

\`\`\`bash
npm run sbt -- ${cmdName}
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`${cmdName}\` | ${name} plugin command |

## Configuration

Configure via \`supabase-tools.config.json\` plugin config block.

## Project Structure

\`\`\`
packages/plugin-${name}/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
\`\`\`
`;
}
