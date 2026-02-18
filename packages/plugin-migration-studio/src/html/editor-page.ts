/**
 * Legacy HTML page placeholder.
 * Migration Studio UI now lives in @sbtools/ui-web dashboard route.
 */
export function generateEditorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Migration Studio</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.5;">
    <h1 style="margin-top:0;">Migration Studio server is running</h1>
    <p>The UI moved to the dashboard route <code>/migration-studio</code> in <code>@sbtools/ui-web</code>.</p>
    <p>Keep this process running and open the dashboard page to use Migration Studio.</p>
  </body>
</html>`;
}
