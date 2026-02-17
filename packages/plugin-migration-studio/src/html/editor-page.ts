/**
 * Main HTML page for Migration Studio.
 * Delegates rendering to shared @sbtools/ui-web renderer.
 */
import type { PluginContext } from "@sbtools/sdk";
import { renderMigrationStudioPage } from "@sbtools/ui-web";
import { getStyles } from "./styles.js";

export function generateEditorPage(ctx: PluginContext): string {
  return renderMigrationStudioPage({
    migrationsDir: ctx.paths.migrations,
    styles: getStyles(),
  });
}
