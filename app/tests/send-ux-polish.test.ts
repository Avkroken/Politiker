import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/send-ux-polish.js", import.meta.url), "utf8");

test("send UX polish script parses", () => {
  assert.doesNotThrow(() => new Function(source));
});

test("notices have readable auto-dismiss durations", () => {
  assert.match(source, /info:8000/);
  assert.match(source, /success:8000/);
  assert.match(source, /warning:12000/);
  assert.match(source, /error:12000/);
  assert.match(source, /setTimeout\(clearStoredNotice,remaining\)/);
});

test("compose and review explain signature handling", () => {
  assert.match(source, /Mail-appens vanliga signatur läggs inte till automatiskt vid utskick/);
  assert.match(source, /Ingen extra signatur från Mail-appen läggs till/);
  assert.match(source, /dataset\.signatureNote=kind/);
});
