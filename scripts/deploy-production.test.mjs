import assert from "node:assert/strict";
import test from "node:test";

import {
  deployProduction,
  validateProductionResponse,
  workerFromCwd,
  workersBuildMetadata,
} from "./deploy-production.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("Workers Builds production metadata requires main and a full commit SHA", () => {
  assert.deepEqual(workersBuildMetadata({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", WORKERS_CI_COMMIT_SHA: SHA }), {
    commitSha: SHA,
  });
  assert.throws(
    () => workersBuildMetadata({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "feature", WORKERS_CI_COMMIT_SHA: SHA }),
    /expected main/,
  );
  assert.throws(
    () => workersBuildMetadata({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", WORKERS_CI_COMMIT_SHA: "short" }),
    /valid WORKERS_CI_COMMIT_SHA/,
  );
});

test("Worker roots select repository-specific migration ownership", () => {
  assert.equal(workerFromCwd("/repo/app").migrate, true);
  assert.equal(workerFromCwd("/repo/log-archive").migrate, false);
  assert.throws(() => workerFromCwd("/repo/unknown"), /Unknown Worker root/);
});

test("app applies migrations before strict deploy and then checks production", async () => {
  const calls = [];
  await deployProduction({
    cwd: "/repo/app",
    env: { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", WORKERS_CI_COMMIT_SHA: SHA },
    spawn: (command, args) => {
      calls.push([command, ...args]);
      return { status: 0 };
    },
    fetchImpl: async () => new Response("ok", { status: 200 }),
    sleep: async () => {},
  });

  assert.deepEqual(calls, [
    ["bash", "../infra/apply-migrations.sh"],
    ["wrangler", "deploy", "--strict", "--outdir", "dist", "--message", `Git ${SHA}`],
  ]);
});

test("tail-only log archive deploys without migrations or HTTP checks", async () => {
  const calls = [];
  let fetched = false;
  await deployProduction({
    cwd: "/repo/log-archive",
    env: {},
    spawn: (command, args) => {
      calls.push([command, ...args]);
      return { status: 0 };
    },
    fetchImpl: async () => {
      fetched = true;
      throw new Error("should not fetch");
    },
  });

  assert.deepEqual(calls, [["wrangler", "deploy", "--strict"]]);
  assert.equal(fetched, false);
});

test("production root check fails closed", async () => {
  const check = { url: "https://politiker.denied.se/", status: 200 };
  await validateProductionResponse(check, new Response("ok", { status: 200 }));
  await assert.rejects(
    validateProductionResponse(check, new Response("blocked", { status: 403 })),
    /expected 200/,
  );
});
