import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name: string) =>
  readFileSync(new URL("../public/" + name, import.meta.url), "utf8");

test("all primary public pages expose PWA install metadata", () => {
  for (const name of ["index.html", "faq.html", "resurser.html"]) {
    const html = read(name);
    assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/);
    assert.match(html, /<link rel="apple-touch-icon"[^>]+favicon-192\.png/);
    assert.match(html, /<script src="\/pwa\.js" defer><\/script>/);
  }
});

test("service worker is secure-context registered and network-only", () => {
  const pwa = read("pwa.js");
  const worker = read("service-worker.js");

  assert.match(pwa, /window\.isSecureContext/);
  assert.match(pwa, /serviceWorker\.register\("\/service-worker\.js"/);
  assert.match(worker, /self\.addEventListener\("fetch"/);
  assert.doesNotMatch(worker, /caches\./);
  assert.doesNotMatch(worker, /respondWith\(/);
  assert.doesNotMatch(worker, /\/api\//);
});
