import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../public/civic-polish.css", import.meta.url), "utf8");

test("mobile home microcopy keeps a readable font floor", () => {
  const mobile = css.match(/@media\(max-width:520px\)\{([\s\S]*)\}\s*$/);
  assert.ok(mobile, "mobile polish block should exist");
  assert.match(mobile[1], /\.hero-proof__item strong\s*\{[^}]*font-size:\.9rem;/s);
  assert.match(mobile[1], /\.hero-proof__item small,\s*\.level-card__copy small\s*\{[^}]*font-size:\.8rem;/s);
});
