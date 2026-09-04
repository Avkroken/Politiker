import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { test } from "node:test";

function loadParser(): (text: string) => { email: string; name: string }[] {
  const source = readFileSync(new URL("../public/private-recipient-polish.js", import.meta.url), "utf8");
  const context = createContext({});
  new Script(source).runInContext(context);
  return context.parseContactText as (text: string) => { email: string; name: string }[];
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("extracts CSV, plain and display-name recipient formats", () => {
  const parse = loadParser();
  assert.deepEqual(plain(parse([
    "Namn,E-post",
    "Anna Andersson,anna@example.se",
    "erik@example.se",
    "Lisa Larsson <lisa@example.se>",
  ].join("\n"))), [
    { email: "anna@example.se", name: "Anna Andersson" },
    { email: "erik@example.se", name: "" },
    { email: "lisa@example.se", name: "Lisa Larsson" },
  ]);
});

test("extracts several addresses from the same line and deduplicates them", () => {
  const parse = loadParser();
  assert.deepEqual(plain(parse("anna@example.se; Erik <erik@example.se>; ANNA@example.se")), [
    { email: "anna@example.se", name: "" },
    { email: "erik@example.se", name: "Erik" },
  ]);
});

test("ignores surrounding prose but requires at least one valid address", () => {
  const parse = loadParser();
  assert.deepEqual(plain(parse("Lokala journalister\nKontakta anna@example.se först.")), [
    { email: "anna@example.se", name: "Kontakta först." },
  ]);
  assert.throws(() => parse("Här finns inga adresser"), /inga giltiga e-postadresser/i);
});
