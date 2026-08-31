import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionResponse } from "./verify-production.mjs";

test("production root check fails closed", async () => {
  await validateProductionResponse(new Response("ok", { status: 200 }));
  await assert.rejects(
    validateProductionResponse(new Response("blocked", { status: 403 })),
    /expected 200/,
  );
});
