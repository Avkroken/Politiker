import assert from "node:assert/strict";
import test from "node:test";

import { accessRoute } from "../src/access-routing";

test("canonical admin APIs rewrite to the existing internal handlers", () => {
  assert.deepEqual(accessRoute("/admin/api/accounts"), {
    type: "rewrite",
    pathname: "/api/admin/accounts",
  });
  assert.deepEqual(accessRoute("/admin/api/accounts/abc/reset-password"), {
    type: "rewrite",
    pathname: "/api/admin/accounts/abc/reset-password",
  });
});

test("legacy admin APIs redirect into the Access-protected namespace", () => {
  assert.deepEqual(accessRoute("/api/admin/stats"), {
    type: "redirect",
    pathname: "/admin/api/stats",
  });
  assert.deepEqual(accessRoute("/api/admin/feedback/abc"), {
    type: "redirect",
    pathname: "/admin/api/feedback/abc",
  });
});

test("normal public and signed-in APIs are not moved", () => {
  for (const pathname of [
    "/api/me",
    "/api/send",
    "/api/feedback",
    "/api/oauth/google/start",
    "/",
    "/admin",
  ]) {
    assert.deepEqual(accessRoute(pathname), { type: "pass", pathname });
  }
});
