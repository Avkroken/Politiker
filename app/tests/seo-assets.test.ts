import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicDir = new URL("../public/", import.meta.url);

async function readPublic(name: string) {
  return readFile(new URL(name, publicDir), "utf8");
}

test("public index and FAQ expose canonical index metadata", async () => {
  const [index, faq] = await Promise.all([
    readPublic("index.html"),
    readPublic("faq.html"),
  ]);

  assert.match(index, /<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.match(index, /<link rel="canonical" href="https:\/\/politiker\.denied\.se\/">/);
  assert.match(faq, /<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.match(faq, /<link rel="canonical" href="https:\/\/politiker\.denied\.se\/faq\.html">/);
});

test("crawler assets advertise only public content", async () => {
  const [robots, sitemap] = await Promise.all([
    readPublic("robots.txt"),
    readPublic("sitemap.xml"),
  ]);

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/politiker\.denied\.se\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/politiker\.denied\.se\/<\/loc>/);
  assert.match(sitemap, /https:\/\/politiker\.denied\.se\/faq\.html<\/loc>/);
  assert.doesNotMatch(sitemap, /\/admin|\/api\//);
});
