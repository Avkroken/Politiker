import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../public/civic-polish.css", import.meta.url), "utf8");

test("uses the Swedish yellow and blue palette tokens", () => {
  assert.match(css, /--accent:#ffcd00;/i);
  assert.match(css, /--accent-blue:#006aa7;/i);
});

test("disabled primary actions are neutral instead of faded yellow", () => {
  const match = css.match(/\.button--primary:disabled,\s*\.button--primary:disabled:hover\{([^}]*)\}/s);
  assert.ok(match, "disabled primary button rule must exist");
  assert.match(match[1], /opacity:1;/);
  assert.match(match[1], /background:var\(--surface-2\);/);
  assert.doesNotMatch(match[1], /background:[^;]*var\(--accent\)/);
});

test("open recipient details use the exact accent yellow", () => {
  assert.match(css, /\.details\[open\]>summary\{[^}]*color:var\(--accent\);/s);
});
