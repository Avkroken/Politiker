import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../public/letter-import.js";

type LetterImportTools = {
  decodeTextBytes(input: Uint8Array, options?: { html?: boolean }): { text: string; encoding: string };
  validateText(text: string): string;
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

test("HTML sanitizer does not return parsed untrusted markup through innerHTML", async () => {
  const source = await readFile(new URL("../public/letter-import.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /return\s+parsed\.body\.innerHTML\b/);
  assert.match(source, /SAFE_TAGS\.has\(tag\)/);
  assert.match(source, /map\(serializeSafeNode\)\.join\(''\)/);
  assert.match(source, /escapeHtmlAttribute\(href\)/);
});
