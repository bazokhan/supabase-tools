export function generateSkillMd(name: string, external: boolean): string {
  const pkgName = `@sbtools/plugin-${name}`;
  const cmdName = name;
  const loc = external ? `plugin-${name}/` : `supabase-tools/packages/plugin-${name}/`;

  return `# ${pkgName}

Plugin for supabase-tools that provides ${name} functionality. Lives at \`${loc}\`.

## When to Use

Use this plugin when the user needs to:
- (Describe ${name} use cases)

## CLI Commands

- \`sbt ${cmdName}\` — ${name} plugin command

## Configuration

Plugin-specific config in \`supabase-tools.config.json\` → \`plugins[].config\`.

## File Layout

\`\`\`
plugin-${name}/
└── src/index.ts   # SbtPlugin with ${cmdName} command
\`\`\`
`;
}
