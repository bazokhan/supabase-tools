/**
 * Init command: create config, directories, and .env for compose.
 */
import fs from "node:fs";
import path from "node:path";
import { ui, sanitizeContainerPrefix } from "@sbtools/sdk";
import { config, resolve } from "../config.js";

/** Create directory structure only (no .env). */
export function ensureDirs(): void {
  const functionsDir = resolve(config.paths.functions);
  fs.mkdirSync(functionsDir, { recursive: true });
  const fnEnvFile = path.join(functionsDir, ".env");
  if (!fs.existsSync(fnEnvFile)) {
    fs.writeFileSync(fnEnvFile, "# Edge function environment variables\n", "utf8");
  }
  const docsAbsolute = resolve(config.paths.docsOutput);
  fs.mkdirSync(docsAbsolute, { recursive: true });
  fs.mkdirSync(config.sbtDataDir, { recursive: true });
  fs.mkdirSync(path.join(config.sbtDataDir, "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(config.sbtDataDir, "schemaspy-out"), { recursive: true });
}

/** Write .env file for Docker compose. */
export function writeComposeEnv(): void {
  const docsAbsolute = resolve(config.paths.docsOutput);
  const containerPrefix = sanitizeContainerPrefix(config.project.name);
  const functionsAbs = path.resolve(config.projectRoot, config.paths.functions);
  const openapiSpec = path.join(config.sbtDataDir, "openapi-spec.json");
  const schemaspyOut = path.join(config.sbtDataDir, "schemaspy-out");
  const composeEnv = path.join(config.sbtDataDir, ".env");
  const envContent = [
    `SBT_PREFIX=${containerPrefix}`,
    `SBT_DOCS_DIR=${docsAbsolute}`,
    `SBT_FUNCTIONS_DIR=${functionsAbs}`,
    `SBT_OPENAPI_SPEC=${openapiSpec}`,
    `SBT_SCHEMASPY_OUT=${schemaspyOut}`,
  ].join("\n") + "\n";
  fs.writeFileSync(composeEnv, envContent, "utf8");
}

/** Ensure .sbt/ is in .gitignore. */
export function ensureGitignoreSbtEntry(): void {
  const gitignorePath = path.join(config.projectRoot, ".gitignore");
  const entry = ".sbt/";
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, entry + "\n", "utf8");
    ui.detail(`Added ${entry} to .gitignore`);
    return;
  }
  const content = fs.readFileSync(gitignorePath, "utf8");
  const lines = content.split(/\r?\n/);
  const hasEntry = lines.some((line) => /^\.sbt\/?$/m.test(line.trim()));
  if (!hasEntry) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(gitignorePath, content + suffix + entry + "\n", "utf8");
    ui.detail(`Added ${entry} to .gitignore`);
  }
}

/** Run init: create config if missing, ensure dirs and gitignore. */
export function init(): void {
  const configPath = path.join(config.projectRoot, "supabase-tools.config.json");
  if (fs.existsSync(configPath)) {
    ui.info(`Config already exists at ${configPath}`);
    ensureDirs();
    writeComposeEnv();
    ensureGitignoreSbtEntry();
    return;
  }
  const projectName = (() => {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(config.projectRoot, "package.json"), "utf8")
      ) as { name?: string };
      return pkg.name ?? path.basename(config.projectRoot);
    } catch {
      return path.basename(config.projectRoot);
    }
  })();
  const defaultConfig = {
    paths: {
      migrations: "supabase/migrations",
      snapshot: "supabase/current",
      docsOutput: "docs",
      functions: "supabase/functions",
    },
    db: {
      url: "postgresql://postgres:postgres@localhost:54322/postgres",
      container: "supabase-db",
    },
    api: {
      url: "http://localhost:54321",
      studioUrl: "http://localhost:54323",
      inbucketUrl: "http://localhost:54324",
    },
    project: { name: projectName },
    plugins: [],
  };
  fs.writeFileSync(
    configPath,
    JSON.stringify(defaultConfig, null, 2) + "\n",
    "utf8"
  );
  ui.success(`Created ${configPath}`);
  ensureDirs();
  writeComposeEnv();
  ensureGitignoreSbtEntry();
}
