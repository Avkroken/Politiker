import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(
  new URL("../public/recipient-filter-groups.js", import.meta.url),
  "utf8",
);
const index = readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../public/civic-polish.css", import.meta.url),
  "utf8",
);

test("advanced recipient areas are rendered as collapsible audience groups", () => {
  assert.match(script, /filter-area-group/);
  assert.match(script, /details\.dataset\.areaType = type/);
  assert.match(script, /selectedTypes\.has\(type\)/);
  assert.match(script, /openAreaTypes\.has\(type\)/);
  assert.match(script, /Visar de första 200/);
});

test("selected audience types control which advanced sections are relevant", () => {
  assert.match(script, /selectedTypes\.has\('academia'\)/);
  assert.match(script, /selectedTypes\.has\('media'\)/);
  assert.match(script, /selectedTypes\.has\('kommun'\).*selectedTypes\.has\('region'\)/s);
  assert.match(script, /POLITICAL_TYPES/);
  assert.match(script, /setRelevant\(academicFilter, hasAcademia/);
  assert.match(script, /setRelevant\(mediaFilter, hasMedia/);
  assert.match(script, /setRelevant\(localFilter, hasLocal/);
});

test("area search works across grouped audiences without flattening the registry", () => {
  assert.match(script, /groupedAreaData\(needle\)/);
  assert.match(script, /renderAreaGroups\(event\.target\.value\)/);
  assert.match(script, /Kommun, region, universitet/);
});

test("grouped filter UI is loaded after the base send and metadata scripts", () => {
  const send = index.indexOf('/app-send.js');
  const meta = index.indexOf('/recipient-meta.js');
  const groups = index.indexOf('/recipient-filter-groups.js');
  assert.ok(send >= 0 && meta > send && groups > meta);
});

test("collapsible audience groups have dedicated responsive styling", () => {
  assert.match(css, /#area-list\.filter-area-groups/);
  assert.match(css, /\.filter-area-group\[open\]/);
  assert.match(css, /\.filter-area-group__meta/);
  assert.match(css, /\.advanced-filter-section\[hidden\]/);
});
