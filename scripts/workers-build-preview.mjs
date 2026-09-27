#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, "app");
const academicScript = join(root, "kontakter", "scraper", "fetch_academics.py");
const migrationConfig = "wrangler.preview-migrations.jsonc";

function run(command, args, { cwd = appDir } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function requireWorkersBuildPreview() {
  if (process.env.WORKERS_CI !== "1") {
    throw new Error("preview:workers-builds may only run inside Cloudflare Workers Builds");
  }
  const branch = process.env.WORKERS_CI_BRANCH;
  if (!branch) throw new Error("WORKERS_CI_BRANCH is required");
  if (branch === "main") throw new Error("Preview deploy must not run for the production branch");
}

requireWorkersBuildPreview();

console.log(`Workers Builds preview deploy for branch ${process.env.WORKERS_CI_BRANCH}`);
run("npm", ["run", "validate"]);
run("npx", ["wrangler", "d1", "migrations", "apply", "PREVIEW_DB", "--remote", "--config", migrationConfig]);

const tempDir = mkdtempSync(join(tmpdir(), "politiker-preview-academics-"));
try {
  const sqlFile = join(tempDir, "academic-preview.sql");
  run("python", [academicScript, "--sql-file", sqlFile], { cwd: root });
  run("npx", [
    "wrangler",
    "d1",
    "execute",
    "PREVIEW_DB",
    "--remote",
    "--config",
    migrationConfig,
    "--file",
    sqlFile,
  ]);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

run("npx", ["wrangler", "preview"]);
