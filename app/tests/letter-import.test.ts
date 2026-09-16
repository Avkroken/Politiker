import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../public/letter-import.js";

type LetterImportTools = {
  decodeTextBytes(input: Uint8Array, options?: { html?: boolean }): { text: string; encoding: string };
  validateText(text: string): string;
  sanitizeHtml(html: string, options?: { validate?: boolean }): string;
  htmlToText(html: string, options?: { validate?: boolean }): string;
};

const tools = (globalThis as typeof globalThis & { PolitikerLetterImport: LetterImportTools }).PolitikerLetterImport;

test("UTF-8 Swedish text keeps å ä ö and punctuation", () => {
  const input = new TextEncoder().encode("Och då – åäö ÅÄÖ");
  const decoded = tools.decodeTextBytes(input);
  assert.equal(decoded.text, "Och då – åäö ÅÄÖ");
  assert.equal(decoded.encoding, "utf-8");
});

test("Windows-1252 input falls back without replacement characters", () => {
  const input = Uint8Array.from([0x64, 0xe5, 0x20, 0x96, 0x20, 0xe5, 0xe4, 0xf6]);
  const decoded = tools.decodeTextBytes(input);
  assert.equal(decoded.text, "då – åäö");
  assert.equal(decoded.encoding, "windows-1252");
});

test("HTML declared as Windows-1252 uses its declared charset", () => {
  const prefix = new TextEncoder().encode('<meta charset="windows-1252"><p>d');
  const suffix = new TextEncoder().encode('</p>');
  const input = new Uint8Array(prefix.length + 1 + suffix.length);
  input.set(prefix);
  input[prefix.length] = 0xe5;
  input.set(suffix, prefix.length + 1);
  const decoded = tools.decodeTextBytes(input, { html: true });
  assert.equal(decoded.encoding, "windows-1252");
  assert.match(decoded.text, /då/);
});

test("replacement characters are rejected instead of silently imported", () => {
  const input = new TextEncoder().encode("det, och d� � har systemet");
  assert.throws(() => tools.decodeTextBytes(input), /ersättningstecken/);
});

test("common UTF-8 mojibake is rejected", () => {
  const input = new TextEncoder().encode("dÃ¥ har systemet");
  assert.throws(() => tools.decodeTextBytes(input), /felkodad/);
});

test("HTML sanitizer preserves safe paragraphs and line breaks", () => {
  const input = "<p>Hej<br>värld</p>";
  assert.equal(tools.sanitizeHtml(input), input);
  assert.equal(tools.htmlToText(input), "Hej\nvärld");
});

test("HTML sanitizer removes unsafe element subtrees", () => {
  const input = "<p>Hej<script>alert(1)</script><style>body{display:none}</style>värld</p>";
  assert.equal(tools.sanitizeHtml(input), "<p>Hejvärld</p>");
  assert.equal(tools.htmlToText(input), "Hejvärld");
});

test("HTML sanitizer allowlists link protocols and attributes", () => {
  assert.equal(
    tools.sanitizeHtml('<a href="javascript:alert(1)" onclick="alert(1)">osäker</a>'),
    "<a>osäker</a>",
  );
  assert.equal(
    tools.sanitizeHtml('<a href="https://example.com/path?a=1&b=2" onclick="alert(1)">säker</a>'),
    '<a href="https://example.com/path?a=1&amp;b=2" rel="noopener noreferrer">säker</a>',
  );
});

test("HTML sanitizer keeps encoded markup as text, not executable markup", () => {
  assert.equal(tools.sanitizeHtml("<p>&lt;script&gt;hej&lt;/script&gt;</p>"), "<p>&lt;script&gt;hej&lt;/script&gt;</p>");
  assert.equal(tools.htmlToText("<p>&lt;script&gt;hej&lt;/script&gt;</p>"), "<script>hej</script>");
});

test("HTML sanitizer does not feed untrusted strings to an HTML parser", async () => {
  const source = await readFile(new URL("../public/letter-import.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /parseFromString\(/);
  assert.match(source, /SAFE_TAGS\.has\(tag\)/);
  assert.match(source, /DROP_TAGS\.has\(tag\)/);
  assert.match(source, /escapeHtmlAttribute\(href\)/);
});
