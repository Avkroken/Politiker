import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

test("root requests run through the Worker so visits are recorded", () => {
  assert.deepEqual(config.assets?.run_worker_first, ["/", "/api/*"]);
});
