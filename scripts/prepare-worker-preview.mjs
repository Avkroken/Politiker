#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, "app");
const WRANGLER_VERSION = process.env.PREVIEW_WRANGLER_VERSION || "4.139.0";

const names = {
  d1: "politiker-preview-eu",
  kv: "politiker-preview-sessions",
  r2: "politiker-preview-attachments",
  queue: "politiker-preview-send-jobs",
};

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync(
    "npx",
    ["--yes", `wrangler@${WRANGLER_VERSION}`, ...args],
    {
      cwd: appDir,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`wrangler ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result;
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  const candidates = [text.indexOf("["), text.indexOf("{")].filter((i) => i >= 0);
  const start = candidates.length ? Math.min(...candidates) : -1;
  if (start < 0) throw new Error("Wrangler did not return JSON");
  return JSON.parse(text.slice(start));
}

function ensureD1() {
  let list = parseJsonOutput(run(["d1", "list", "--json"]).stdout);
  let database = list.find((item) => item.name === names.d1);
  if (!database) {
    run(["d1", "create", names.d1, "--jurisdiction", "eu"]);
    list = parseJsonOutput(run(["d1", "list", "--json"]).stdout);
    database = list.find((item) => item.name === names.d1);
  }
  const id = database?.uuid || database?.id;
  if (!id) throw new Error("Could not resolve preview D1 database id");
  return id;
}

function ensureKv() {
  let list = parseJsonOutput(run(["kv", "namespace", "list"]).stdout);
  let namespace = list.find((item) => item.title === names.kv || item.name === names.kv);
  if (!namespace) {
    run(["kv", "namespace", "create", names.kv]);
    list = parseJsonOutput(run(["kv", "namespace", "list"]).stdout);
    namespace = list.find((item) => item.title === names.kv || item.name === names.kv);
  }
  if (!namespace?.id) throw new Error("Could not resolve preview KV namespace id");
  return namespace.id;
}

function ensureR2() {
  const info = run(["r2", "bucket", "info", names.r2, "--jurisdiction", "eu", "--json"], { allowFailure: true });
  if (info.status !== 0) {
    run(["r2", "bucket", "create", names.r2, "--jurisdiction", "eu"]);
  }
}

function ensureQueue() {
  const info = run(["queues", "info", names.queue], { allowFailure: true });
  if (info.status !== 0) {
    run(["queues", "create", names.queue, "--message-retention-period-secs", "60"]);
  } else {
    run(["queues", "update", names.queue, "--message-retention-period-secs", "60"]);
  }
}

const d1Id = ensureD1();
const kvId = ensureKv();
ensureR2();
ensureQueue();

const production = JSON.parse(
  (await import("node:fs/promises")).readFile
    ? await (await import("node:fs/promises")).readFile(join(appDir, "wrangler.jsonc"), "utf8")
    : "",
);

production.previews = {
  vars: {
    PREVIEW_MODE: "1",
    SYSTEM_SMTP_HOST: "preview.invalid",
    SYSTEM_SMTP_PORT: "587",
    SYSTEM_SMTP_USER: "disabled",
    SYSTEM_FROM_ADDRESS: "preview@invalid",
    FEEDBACK_NOTIFY_EMAIL: "preview@invalid",
    TURNSTILE_HOSTNAMES: "preview",
    VISITOR_SALT: "isolated-preview-only",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: names.d1,
      database_id: d1Id,
      migrations_table: "d1_migrations",
      migrations_dir: "../infra/migrations",
    },
  ],
  kv_namespaces: [{ binding: "SESSIONS", id: kvId }],
  queues: {
    producers: [{ queue: names.queue, binding: "SEND_QUEUE" }],
  },
  durable_objects: {
    bindings: [{ name: "RATE_LIMITER", class_name: "CredentialRateLimiter" }],
  },
  r2_buckets: [
    {
      binding: "ATTACHMENTS",
      bucket_name: names.r2,
      jurisdiction: "eu",
    },
  ],
};

const previewConfig = join(appDir, ".wrangler-preview.json");
writeFileSync(previewConfig, JSON.stringify(production, null, 2) + "\n");

const migrationConfig = join(appDir, ".wrangler-preview-migrations.json");
writeFileSync(
  migrationConfig,
  JSON.stringify(
    {
      d1_databases: [
        {
          binding: "PREVIEW_DB",
          database_name: names.d1,
          database_id: d1Id,
          migrations_table: "d1_migrations",
          migrations_dir: "../infra/migrations",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);

console.log(
  JSON.stringify({
    wrangler: WRANGLER_VERSION,
    resources: {
      d1: names.d1,
      kv: names.kv,
      r2: names.r2,
      queue: names.queue,
    },
    previewConfig,
    migrationConfig,
  }),
);
