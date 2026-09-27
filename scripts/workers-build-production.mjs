#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, "app");
const academicScript = join(root, "kontakter", "scraper", "fetch_academics.py");

function run(command, args, { cwd = appDir, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture && result.stdout) process.stdout.write(result.stdout);
    if (capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return capture ? String(result.stdout || "") : "";
}

function requireWorkersBuildProduction() {
  if (process.env.WORKERS_CI !== "1") {
    throw new Error("deploy:workers-builds may only run inside Cloudflare Workers Builds");
  }
  if (process.env.WORKERS_CI_BRANCH !== "main") {
    throw new Error(
      `Production deploy requires WORKERS_CI_BRANCH=main, got ${process.env.WORKERS_CI_BRANCH || "<unset>"}`,
    );
  }
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  const candidates = [text.indexOf("["), text.indexOf("{")].filter((index) => index >= 0);
  if (!candidates.length) throw new Error("Wrangler did not return JSON");
  return JSON.parse(text.slice(Math.min(...candidates)));
}

function findCounts(value) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findCounts(child);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    if ("contact_count" in value && "field_count" in value) {
      return {
        contacts: Number(value.contact_count),
        fields: Number(value.field_count),
      };
    }
    for (const child of Object.values(value)) {
      const found = findCounts(child);
      if (found) return found;
    }
  }
  return null;
}

requireWorkersBuildProduction();

console.log(`Workers Builds production deploy for ${process.env.WORKERS_CI_COMMIT_SHA || "unknown commit"}`);
run("npm", ["run", "validate"]);
run("npm", ["run", "migrate:production"]);
run("npm", ["run", "deploy"]);

const tempDir = mkdtempSync(join(tmpdir(), "politiker-academics-"));
try {
  const sqlFile = join(tempDir, "academic-contacts.sql");
  run("python", [academicScript, "--sql-file", sqlFile], { cwd: root });
  const expectedRaw = run("python", [academicScript, "--count"], { cwd: root, capture: true }).trim();
  const expected = Number(expectedRaw);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error(`Academic contact count is invalid: ${expectedRaw}`);
  }

  run("npx", ["wrangler", "d1", "execute", "politiker-eu", "--remote", "--file", sqlFile]);

  const query =
    "SELECT COUNT(*) AS contact_count, COUNT(DISTINCT academic_field) AS field_count " +
    "FROM public_contacts WHERE area_type='academia' AND academic_field IN " +
    "('political-science','public-administration','public-law');";
  const raw = run(
    "npx",
    ["wrangler", "d1", "execute", "politiker-eu", "--remote", "--json", "--command", query],
    { capture: true },
  );
  const counts = findCounts(parseJsonOutput(raw));
  if (!counts) throw new Error("Could not read academic verification counts from Wrangler JSON");

  console.log(`Academia after deploy: ${counts.contacts} contacts across ${counts.fields} core fields.`);
  if (counts.contacts < expected) {
    throw new Error(`Too few academic contacts: ${counts.contacts}, expected at least ${expected}`);
  }
  if (counts.fields !== 3) {
    throw new Error(`Wrong number of academic core fields: ${counts.fields}, expected 3`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

run("npm", ["run", "verify:production"]);
