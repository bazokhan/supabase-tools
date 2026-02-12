# Publishing Guide

## CI/CD (Automated)

Releases are automated via GitHub Actions using [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements) (OIDC — no tokens needed).

### One-time setup

For each `@sbtools/*` package on [npmjs.com](https://www.npmjs.com) → Settings → Trusted Publishing → Add:

| Field | Value |
|---|---|
| Publisher | GitHub Actions |
| Organization or user | `bazokhan` |
| Repository | `supabase-tools` |
| Workflow filename | `release.yml` |
| Environment name | _(leave empty)_ |

### How it works

1. Make changes on a feature branch
2. Run `npx changeset` — describe what changed and the semver bump type
3. Commit the generated `.changeset/*.md` file with your PR
4. Merge to `main` — the release workflow will:
   - Open a "Version Packages" PR (bumps versions + updates CHANGELOGs)
   - When that PR is merged, it publishes all changed packages to npm with provenance

## Manual Publishing (Local)

For one-off or first-time publishes:

```bash
npm login
npm run build
npm publish -w packages/sdk --access public
npm publish -w packages/core --access public
# ...repeat for each plugin, one at a time (avoids OTP rate limiting)
```

## Notes

- All `@sbtools/*` packages are version-linked — bumps propagate across the scope
- Starting version: `0.1.0` (pre-stable, semver 0.x)
- Packages are published with `access: public` (configured in `.changeset/config.json`)
