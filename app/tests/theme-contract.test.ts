import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const publicAsset = (name: string) =>
  readFileSync(new URL("../public/" + name, import.meta.url), "utf8");

test("shared Avkroken themes preserve Politiker identity tokens", () => {
  const theme = publicAsset("theme.css");
  const civic = publicAsset("civic-polish.css");
  const script = publicAsset("theme.js");

  assert.match(theme, /:root\[data-theme="legacy"\]/);
  assert.match(theme, /:root\[data-theme="forest"\]/);
  assert.match(theme, /:root\[data-theme="blackout"\]/);
  assert.match(theme, /rgba\(36,231,232,.11\)/);
  assert.match(theme, /rgba\(213,29,203,.10\)/);
  assert.match(theme, /background-size:42px 42px/);
  assert.doesNotMatch(theme, /--accent:/);
  assert.match(civic, /--accent:#ffd70d/i);
  assert.match(civic, /--accent-blue:#2d5d8d/i);
  assert.match(script, /avkroken\.theme/);
  assert.match(script, /avkroken_theme/);
  assert.match(script, /Domain=\.denied\.se/);
});

test("all primary pages expose Legacy, Avkroken and Blackout", () => {
  for (const name of ["index.html", "faq.html", "resurser.html"]) {
    const html = publicAsset(name);
    assert.match(html, /data-theme="legacy"/);
    assert.match(html, /href="\/theme\.css"/);
    assert.equal((html.match(/src="\/theme\.js"/g) ?? []).length, 1);
    assert.match(html, /value="legacy">Legacy/);
    assert.match(html, /value="forest">Avkroken/);
    assert.match(html, /value="blackout">Blackout/);
  }
});
