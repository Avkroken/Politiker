import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../public/site.webmanifest", import.meta.url), "utf8"),
) as {
  name: string;
  icons: Array<{ src: string; sizes: string; type: string }>;
};

test("publishes broad link-preview metadata with absolute image URLs", () => {
  const imageUrl = "https://politiker.denied.se/og-image.png";

  assert.match(html, /<link rel="canonical" href="https:\/\/politiker\.denied\.se\/">/);
  assert.ok(html.includes(`<link rel="image_src" href="${imageUrl}">`));
  assert.ok(html.includes(`<meta itemprop="image" content="${imageUrl}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}">`));
  assert.ok(html.includes(`<meta property="og:image:secure_url" content="${imageUrl}">`));
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}">`));
  assert.match(html, /<meta name="twitter:image:alt" content="PolitikerKontakt – nå politiker direkt">/);
  assert.match(html, /max-image-preview:large/);
});

test("allows public preview images and favicons to load cross-origin", () => {
  assert.match(
    headers,
    /\/og-image\.png\r?\n\s*! Cross-Origin-Resource-Policy\r?\n\s*Access-Control-Allow-Origin: \*/,
  );
  assert.match(
    headers,
    /\/favicon\*\r?\n\s*! Cross-Origin-Resource-Policy\r?\n\s*Access-Control-Allow-Origin: \*/,
  );
});

test("publishes a manifest backed by the existing app icons", () => {
  assert.equal(manifest.name, "PolitikerKontakt");
  assert.deepEqual(manifest.icons, [
    { src: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/favicon-512.png", sizes: "512x512", type: "image/png" },
  ]);
  assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/);
});