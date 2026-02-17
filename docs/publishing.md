---
description: How to publish @sbtools packages to npm using changesets and CI.
---

# Version and Release Guide

## Prerequisites

1. Create the `@sbtools` organization on [npmjs.com](https://www.npmjs.com) (free for public packages)
2. `npm login` to authenticate

## First-Time Publish

1. `npm run build` — compile all packages
2. `npx changeset publish` — publishes all packages at 0.1.0

## Subsequent Releases

1. Make your changes
2. `npx changeset` — interactively create a changeset describing what changed
3. Commit the changeset file with your PR
4. When ready to release:
   - `npx changeset version` — bumps package versions and updates CHANGELOGs
   - `npm run release` — builds and publishes all changed packages

## Deprecated Packages

`@sbtools/plugin-atlas-html` and `@sbtools/plugin-docs-server` were merged into `@sbtools/core` as of v0.3.0. To mark them deprecated on npm:

```bash
npm deprecate @sbtools/plugin-atlas-html "Merged into @sbtools/core >=0.3.0. Remove from your plugins config."
npm deprecate @sbtools/plugin-docs-server "Merged into @sbtools/core >=0.3.0. Remove from your plugins config."
```

The core plugin loader already detects these names in config and prints a warning instead of crashing.

## Notes

- All packages are linked: version bumps propagate across `@sbtools/*`
- `access: "public"` is required for scoped packages
- `NPM_TOKEN` secret is required for CI/CD publishing
- Run `npm run lint:conventions` before releasing to check for convention violations
