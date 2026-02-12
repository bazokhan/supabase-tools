/**
 * Builds the full HTML document for the backend-atlas page.
 */
export function buildDocument(opts: {
  styles: string;
  bodyHtml: string;
  scriptJs: string;
}): string {
  const { styles, bodyHtml, scriptJs } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Backend Atlas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
${styles}
  </style>
</head>
<body>
  <div class="page">
${bodyHtml}
  </div>

  <script>
${scriptJs}
  </script>
</body>
</html>
`;
}
