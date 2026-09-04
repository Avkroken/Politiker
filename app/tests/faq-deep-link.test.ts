import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(new URL("../public/faq.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/faq.js", import.meta.url), "utf8");

test("FAQ integrity deep link has a target and loads the hash handler", () => {
  assert.match(html, /<details class="details" id="integritet">/);
  assert.match(html, /<script src="\/faq\.js" defer><\/script>/);
});

test("FAQ hash handler opens targeted details on load and hash changes", () => {
  assert.match(script, /target instanceof HTMLDetailsElement/);
  assert.match(script, /target\.open = true/);
  assert.match(script, /openHashTarget\(\);/);
  assert.match(script, /addEventListener\("hashchange", openHashTarget\)/);
});
