# Skill: Take Dashboard Screenshots

Take viewport screenshots of the `sbt dashboard` pages using the Docker MCP browser and copy them to `docs/images/`.

---

## Key Facts (hard-won from trial and error)

### The browser runs inside Docker
The `mcp__MCP_DOCKER__browser_*` tools run inside a Docker container. You **cannot** use `localhost` to reach host services. Use `host.docker.internal` instead:
```
http://host.docker.internal:3400
```

### Screenshots are saved inside the container
`browser_take_screenshot` with a `filename` saves to `/tmp/playwright-output/<filename>` **inside** the Docker container — not on the host filesystem.

### Extract files with `docker cp`
Find the browser container name, then copy files out:
```bash
# Find container name
docker ps --filter "ancestor=mcr.microsoft.com/playwright" --format "{{.Names}}"
# or just: docker ps  (look for the playwright/MCP container)

# Copy a file to the host
docker cp <container_name>:/tmp/playwright-output/<file>.png "D:/Code/supabase-tools/docs/images/<file>.png"
```

The container name persists across screenshots in the same session (e.g. `pensive_poitras`).

---

## Step-by-Step Procedure

### 1. Set viewport
```
browser_resize  width=1440  height=900
```

### 2. Navigate to dashboard
```
browser_navigate  url=http://host.docker.internal:3400
```

### 3. Enable dark mode (optional)
Take a snapshot to find the toggle button ref, then:
```
browser_click  ref=<toggle-dark-mode-button-ref>
```
The button label reads "Dark" in light mode and "Light" in dark mode when active.

### 4. Navigate to each page and screenshot
Use `browser_click` on the sidebar nav buttons to change pages, then:
```
browser_take_screenshot  type=png  filename=dashboard-<page>-dark.png
```

Do **not** use `fullPage: true` — many pages have unpaginated tables that scroll forever.

Pages and their nav button labels:
| Filename | Nav button label |
|----------|-----------------|
| `dashboard-overview.png` | `Overview` |
| `dashboard-migrations.png` | `Migrations` |
| `dashboard-dependencies.png` | `Dependencies` |
| `dashboard-erd.png` | `ERD Diagrams` |
| `dashboard-commands.png` | `Commands` |

### 5. Copy all files to host
```bash
CONTAINER=pensive_poitras   # replace with actual name from docker ps
DEST="D:/Code/supabase-tools/docs/images"

docker cp $CONTAINER:/tmp/playwright-output/dashboard-overview.png       "$DEST/dashboard-overview.png"
docker cp $CONTAINER:/tmp/playwright-output/dashboard-migrations.png     "$DEST/dashboard-migrations.png"
docker cp $CONTAINER:/tmp/playwright-output/dashboard-dependencies.png   "$DEST/dashboard-dependencies.png"
docker cp $CONTAINER:/tmp/playwright-output/dashboard-erd.png            "$DEST/dashboard-erd.png"
docker cp $CONTAINER:/tmp/playwright-output/dashboard-commands.png       "$DEST/dashboard-commands.png"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Page loads blank / minimal snapshot | Dashboard may still be loading — take a full `browser_snapshot` first to verify content is present |
| `docker cp` source path not found | Check that `browser_take_screenshot` completed without error; the file may have a different name |
| Dark mode not applied | Re-check the toggle button ref from a fresh `browser_snapshot`; ref IDs change between sessions |
| Wrong dashboard (user's own project) | Confirm you are navigating to `host.docker.internal:3400`, not a Vite dev port like `5173` |

---

## Where screenshots are referenced in docs

| Image file | Referenced in |
|------------|---------------|
| `docs/images/dashboard-overview.png` | `docs/ui-web/index.md` |
| `docs/images/dashboard-migrations.png` | `docs/plugins/plugin-migration-audit.md` |
| `docs/images/dashboard-dependencies.png` | `docs/plugins/plugin-depgraph.md` |
| `docs/images/dashboard-erd.png` | `docs/plugins/plugin-erd.md` |
| `docs/images/dashboard-commands.png` | (standalone, no current doc reference) |
