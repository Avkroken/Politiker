import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const editor = await readFile(new URL("../public/letter-editor.js", import.meta.url), "utf8");
const settings = await readFile(new URL("../public/app-settings.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("compose offers the built-in broad-audience intro after the automatic greeting", () => {
  assert.match(editor, /Börja mejlet med/);
  assert.match(editor, /Brett mottagarbrev/);
  assert.match(editor, /Detta brev skickas till politiker, journalister och akademiker/);
  assert.match(editor, /efter den automatiska hälsningen “Hej \{namn\}!”/);
});

test("review and send use the separately selected intro text", () => {
  assert.match(editor, /previewPersonalizedLetter\(bodyHtml,introText\)/);
  assert.match(editor, /introText:introText\|\|undefined/);
  assert.match(editor, /clearIntroSelection\(\)/);
});

test("settings expose reusable intro presets with headings", () => {
  assert.match(settings, /\['intros','Inledningar'\]/);
  assert.match(settings, /<label>Rubrik<\/label>/);
  assert.match(settings, /<label>Text<\/label>/);
  assert.match(settings, /\/api\/letter-intro-presets/);
  assert.match(app, /'mail','intros','account','security','api'/);
});
