import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const editor = await readFile(new URL("../public/letter-editor.js", import.meta.url), "utf8");
const intros = await readFile(new URL("../public/letter-intros.js", import.meta.url), "utf8");
const settings = await readFile(new URL("../public/app-settings.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("intro feature has one browser module loaded before its consumers", () => {
  const introScript = index.indexOf('/letter-intros.js');
  const editorScript = index.indexOf('/letter-editor.js');
  const settingsScript = index.indexOf('/app-settings.js');
  assert.ok(introScript >= 0);
  assert.ok(introScript < editorScript);
  assert.ok(introScript < settingsScript);
  assert.match(settings, /PolitikerLetterIntros\.renderSettings\(\)/);
  assert.match(editor, /window\.PolitikerLetterIntros/);
});

test("compose offers the built-in broad-audience intro after the automatic greeting", () => {
  assert.match(editor, /Börja mejlet med/);
  assert.match(intros, /Brett mottagarbrev/);
  assert.match(intros, /Detta brev skickas till politiker, journalister och akademiker/);
  assert.match(editor, /efter den automatiska hälsningen “Hej \{namn\}!”/);
});

test("review and send use the separately selected intro text", () => {
  assert.match(editor, /const introText=intros\.selectedText\(\)/);
  assert.match(editor, /intros\.previewLetter\(bodyHtml,introText\)/);
  assert.match(editor, /introText:introText\|\|undefined/);
  assert.match(editor, /intros\.clearSelection\(\)/);
});

test("preset display uses DOM text nodes instead of interpolating user text into HTML", () => {
  assert.match(intros, /heading\.textContent=title/);
  assert.match(intros, /detail\.textContent=description/);
  assert.match(intros, /title\.textContent=preset\.title/);
  assert.match(intros, /appendMultilineText\(body,preset\.body\)/);
  assert.doesNotMatch(intros, /innerHTML=.*preset\.(?:title|body)/);
});

test("settings expose reusable intro presets with headings", () => {
  assert.match(settings, /\['intros','Inledningar'\]/);
  assert.match(intros, /<label>Rubrik<\/label>/);
  assert.match(intros, /<label>Text<\/label>/);
  assert.match(intros, /\/api\/letter-intro-presets/);
  assert.match(app, /'mail','intros','account','security','api'/);
});
