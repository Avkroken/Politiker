import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCTION_BRANCH = "main";
const ATTEMPTS = 5;
const RETRY_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 20_000;

const WORKERS = {
  app: {
    name: "politiker",
    migrate: true,
    checks: [{ url: "https://politiker.denied.se/", status: 200 }],
  },
  "log-archive": {
    name: "politiker-log-archive",
    migrate: false,
    checks: [],
  },
};

function run(command, args, spawn = spawnSync) {
  const result = spawn(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function workerFromCwd(cwd = process.cwd()) {
  const key = basename(cwd);
  const worker = WORKERS[key];
  if (!worker) throw new Error(`Unknown Worker root ${key}`);
  return { key, ...worker };
}

export function workersBuildMetadata(env = process.env) {
  if (env.WORKERS_CI !== "1") return { commitSha: null };

  const branch = env.WORKERS_CI_BRANCH?.trim();
  if (branch !== PRODUCTION_BRANCH) {
    throw new Error(`Refusing production deploy from Workers Builds branch ${branch || "<missing>"}; expected ${PRODUCTION_BRANCH}`);
  }

  const commitSha = env.WORKERS_CI_COMMIT_SHA?.trim();
  if (!commitSha || !/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error("Workers Builds did not provide a valid WORKERS_CI_COMMIT_SHA");
  }

  return { commitSha };
}

export async function validateProductionResponse(check, response) {
  if (response.status !== check.status) {
    throw new Error(`${check.url} returned ${response.status}, expected ${check.status}`);
  }
}

async function checkProduction(worker, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (worker.checks.length === 0) {
    console.log(`${worker.name}: no public HTTP surface; deploy command is the production verification boundary`);
    return;
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const failures = [];
    await Promise.all(worker.checks.map(async (check) => {
      try {
        const response = await fetchImpl(check.url, {
          redirect: "manual",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { "user-agent": "politiker-workers-build-production-check" },
        });
        await validateProductionResponse(check, response);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }));

    if (failures.length === 0) {
      console.log(`${worker.name}: production checks passed on attempt ${attempt}`);
      return;
    }

    console.error(`attempt ${attempt}: ${failures.join("; ")}`);
    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  throw new Error(`${worker.name}: production checks failed after ${ATTEMPTS} attempts`);
}

export async function deployProduction({
  cwd = process.cwd(),
  env = process.env,
  spawn = spawnSync,
  fetchImpl = fetch,
  sleep,
} = {}) {
  const worker = workerFromCwd(cwd);
  const { commitSha } = workersBuildMetadata(env);

  if (worker.migrate) run("bash", ["../infra/apply-migrations.sh"], spawn);

  const deployArgs = ["deploy", "--strict"];
  if (commitSha) deployArgs.push("--message", `Git ${commitSha}`);
  run("wrangler", deployArgs, spawn);

  await checkProduction(worker, { fetchImpl, sleep });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployProduction().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`::error::${message}`);
    process.exit(1);
  });
}
