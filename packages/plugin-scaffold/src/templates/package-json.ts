export function generatePackageJson(name: string, external: boolean, sdkVersion: string): string {
  const pkgName = `@sbtools/plugin-${name}`;
  const desc = `${name} plugin for supabase-tools.`;
  const sdkDep = external
    ? `"@sbtools/sdk": "${sdkVersion}"`
    : `"@sbtools/sdk": "workspace:*"`;
  const exportsEntry = external ? '"./index.ts"' : '"./src/index.ts"';
  const filesEntry = external ? '["src", "index.ts"]' : '["src"]';

  return `{
  "name": "${pkgName}",
  "version": "1.0.0",
  "description": "${desc}",
  "type": "module",
  "exports": { ".": ${exportsEntry} },
  "files": ${filesEntry},
  "dependencies": { ${sdkDep} },
  "devDependencies": { "typescript": "^5.6.0" }
}
`;
}
