# Publishing Guide

## Prerequisites

1. Create the `@sbtools` organization on [npmjs.com](https://www.npmjs.com) (free for public packages)
2. `npm login` to authenticate

## First-Time Publish

1. `npm run build` — compile all packages
2. `npx changeset publish` — publishes all packages at 0.1.0

## Subsequent Releases

1. Make your changes
2. `npx changeset` — interactively create a changeset describing what changed
3. Commit the changeset file (e.g. `.changeset/cool-feature.md`) with your PR
4. When ready to release:
   - `npx changeset version` — bumps package versions and updates CHANGELOGs
   - `npm run release` — builds and publishes all changed packages

## Commit Messages

Changesets don’t require a particular format; the changeset files hold the changelog. For consistency:

- **Adding a changeset:** `chore: add changeset for <brief description>`
- **Version bump:** `chore: release` or `chore: version packages`

## Notes

- All packages are linked: version bumps propagate across `@sbtools/*`
- `access: "public"` is required for scoped packages (npm defaults scoped to restricted)
- `NPM_TOKEN` secret is required for CI/CD publishing
