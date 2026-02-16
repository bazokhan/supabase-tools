---
"@sbtools/plugin-scaffold": patch
---

# Scaffold: fix SDK dependency for internal and external plugins

- **Internal plugins**: Use `workspace:*` instead of hardcoded `^0.1.0`.
- **External plugins**: Use npm version (e.g. `^0.3.0`) instead of `file:../supabase-tools/packages/sdk`, which assumed a sibling supabase-tools directory and rarely applied.
- **Dynamic version**: Resolve SDK version from `packages/sdk/package.json` when available; fallback to scaffold's own dependency or `^0.3.0`.
