import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/personalize-letter.ts", import.meta.url), "utf8");
const queueSource = readFileSync(new URL("../src/send-queue.ts", import.meta.url), "utf8");

test("personalization accepts a separate intro and places it after the greeting", () => {
  assert.match(source, /personalizeLetter\(bodyHtml: string, recipientName: string, recipientEmail: string, introText = ""\)/);
  assert.match(source, /greetingWithIntro/);
  assert.match(source, /introBlock/);
  assert.match(source, /safeGreeting/);
  assert.match(source, /bodyHtml/);
});

test("GREETING and legacy greeting placeholders receive the intro at the greeting position", () => {
  assert.match(source, /GREETING/);
  assert.match(source, /förnamn/);
  assert.match(source, /greetingWithIntro/);
});

test("queue consumer passes the send-job intro snapshot into personalization", () => {
  assert.match(queueSource, /sj\.intro_text/);
  assert.match(queueSource, /decryptLetterData\(env,job\.intro_text\)/);
  assert.match(queueSource, /personalizeLetter\(cachedLetterBody,m\.recipientName,m\.recipientEmail,introText\)/);
});
