import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../public/letter-editor.js", import.meta.url), "utf8");
const match = source.match(/function visibleJobError\(job\)\{([\s\S]*?)\n  \}/);
assert.ok(match, "visibleJobError helper should exist");
const visibleJobError = new Function("job", match[1]) as (job: { status: string; last_error?: string | null }) => string;

test("active jobs hide stale SMTP authentication diagnostics", () => {
  assert.equal(
    visibleJobError({ status: "sending", last_error: "Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed" }),
    "",
  );
});

test("stopped jobs still show SMTP authentication diagnostics", () => {
  const error = "Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed";
  assert.equal(visibleJobError({ status: "aborted", last_error: error }), error);
});

test("active jobs still show non-authentication send errors", () => {
  const error = "RCPT TO nekades (550): 550 5.1.1 User unknown";
  assert.equal(visibleJobError({ status: "sending", last_error: error }), error);
});
