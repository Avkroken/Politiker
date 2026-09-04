import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../public/civic-polish.css", import.meta.url), "utf8");

test("uses the Tre Kronor inspired navy and yellow palette tokens", () => {
  assert.match(css, /--bg-soft:#15244d;/i);
  assert.match(css, /--surface-3:#2d5d8d;/i);
  assert.match(css, /--accent:#ffd70d;/i);
  assert.match(css, /--accent-glow:rgba\(255,215,13,\.22\);/i);
});

test("active primary actions use navy text and a restrained yellow glow", () => {
  const match = css.match(/\.button--primary:not\(:disabled\)\{([^}]*)\}/s);
  assert.ok(match, "active primary button rule must exist");
  assert.match(match[1], /color:var\(--bg-soft\);/);
  assert.match(match[1], /box-shadow:[^;]*var\(--accent-glow\)/);
});

test("disabled primary actions are neutral instead of faded yellow", () => {
  const match = css.match(/\.button--primary:disabled,\s*\.button--primary:disabled:hover\{([^}]*)\}/s);
  assert.ok(match, "disabled primary button rule must exist");
  assert.match(match[1], /opacity:1;/);
  assert.match(match[1], /background:var\(--surface-2\);/);
  assert.match(match[1], /box-shadow:none;/);
  assert.doesNotMatch(match[1], /background:[^;]*var\(--accent\)/);
});

test("open details use the yellow accent and subtle glow", () => {
  assert.match(css, /\.details\[open\]>summary,\s*\.private-import-details>summary\{[^}]*color:var\(--accent\);[^}]*text-shadow:/s);
});
