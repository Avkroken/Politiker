import assert from "node:assert/strict";
import test from "node:test";

import { accessRoute } from "../src/access-routing.ts";

test("ordinary admin APIs stay under the Admin Access namespace", () => {
  assert.deepEqual(accessRoute("/admin/api/accounts", "GET"), {
    type: "rewrite",
    pathname: "/api/admin/accounts",
  });
  assert.deepEqual(accessRoute("/admin/api/stats", "GET"), {
    type: "rewrite",
    pathname: "/api/admin/stats",
  });
  assert.deepEqual(accessRoute("/admin/api/export", "GET"), {
    type: "rewrite",
    pathname: "/api/admin/export",
  });
});

test("critical admin mutations are forced into the Kritisk Access namespace", () => {
  const cases: Array<[string, string]> = [
    ["POST", "/admin/api/accounts/abc/reset-password"],
    ["POST", "/admin/api/accounts/abc/toggle-disabled"],
    ["DELETE", "/admin/api/accounts/abc"],
    ["DELETE", "/admin/api/feedback/abc"],
    ["DELETE", "/admin/api/feedback"],
  ];

  for (const [method, pathname] of cases) {
    assert.deepEqual(accessRoute(pathname, method), {
      type: "redirect",
      pathname: pathname.replace("/admin/api/", "/admin/critical/api/"),
    });
  }
});

test("critical canonical APIs rewrite to the existing internal admin handlers", () => {
  assert.deepEqual(accessRoute("/admin/critical/api/accounts/abc/reset-password", "POST"), {
    type: "rewrite",
    pathname: "/api/admin/accounts/abc/reset-password",
  });
  assert.deepEqual(accessRoute("/admin/critical/api/accounts/abc", "DELETE"), {
    type: "rewrite",
    pathname: "/api/admin/accounts/abc",
  });
  assert.deepEqual(accessRoute("/admin/critical/api/feedback/abc", "DELETE"), {
    type: "rewrite",
    pathname: "/api/admin/feedback/abc",
  });
});

test("ordinary operations cannot remain in the Kritisk namespace", () => {
  assert.deepEqual(accessRoute("/admin/critical/api/stats", "GET"), {
    type: "redirect",
    pathname: "/admin/api/stats",
  });
});

test("legacy admin APIs redirect to the correct Access-protected namespace", () => {
  assert.deepEqual(accessRoute("/api/admin/stats", "GET"), {
    type: "redirect",
    pathname: "/admin/api/stats",
  });
  assert.deepEqual(accessRoute("/api/admin/accounts/abc/reset-password", "POST"), {
    type: "redirect",
    pathname: "/admin/critical/api/accounts/abc/reset-password",
  });
  assert.deepEqual(accessRoute("/api/admin/feedback/abc", "DELETE"), {
    type: "redirect",
    pathname: "/admin/critical/api/feedback/abc",
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
    "/admin/critical",
  ]) {
    assert.deepEqual(accessRoute(pathname), { type: "pass", pathname });
  }
});
