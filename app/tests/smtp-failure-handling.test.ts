import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isPermanentRecipientSmtpFailure,
  isSmtpAuthenticationFailure,
  visibleSendJobError,
} from "../../shared/smtp-failure.ts";

const queueSource = readFileSync(new URL("../src/send-queue.ts", import.meta.url), "utf8");

test("SMTP authentication failures are account-scoped, not recipient bounces", () => {
  assert.equal(isSmtpAuthenticationFailure(new Error("Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed")), true);
  assert.equal(isSmtpAuthenticationFailure(new Error("RCPT TO nekades (550): 550 5.1.1 User unknown")), false);
});

test("active jobs hide stale SMTP authentication diagnostics", () => {
  assert.equal(
    visibleSendJobError("sending", "Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed"),
    null,
  );
});

test("stopped jobs still show SMTP authentication diagnostics", () => {
  const error = "Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed";
  assert.equal(visibleSendJobError("aborted", error), error);
});

test("active jobs still show non-authentication send errors", () => {
  const error = "RCPT TO nekades (550): 550 5.1.1 User unknown";
  assert.equal(visibleSendJobError("sending", error), error);
});

test("only permanent recipient rejections mark an address as dead", () => {
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (550): 550 5.1.1 User unknown")), true);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (550): 550 5.7.1 Policy rejection")), false);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (451): 451 4.2.0 Temporary failure")), false);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("Inloggning misslyckades (535): authentication failed")), false);
});

test("queue aborts on SMTP auth failure without counting it as sent or poisoning the recipient", () => {
  assert.match(queueSource, /if\s*\(\s*isSmtpAuthenticationFailure\(err\)\s*\)\s*\{[\s\S]*?recordBlockingSendError\(env\s*,\s*m\s*,\s*errorMsg\)[\s\S]*?queueMsg\.ack\(\)[\s\S]*?aborted\s*=\s*true[\s\S]*?continue\s*;/);
  assert.match(queueSource, /\.bind\(\s*sentCount\s*,\s*bounceCount\s*,\s*aborted\s*\?\s*"aborted"\s*:\s*"sending"\s*,\s*sendJobId\s*\)/);
  assert.match(queueSource, /else\s+if\s*\(\s*markRecipientDead\s*\)\s*await\s+env\.DB\.prepare\(\s*"UPDATE politicians SET verification_status='dead_via_send'/);
});

test("remaining batch messages are acknowledged after a job aborts", () => {
  assert.match(queueSource, /if\s*\(\s*aborted\s*\)\s*\{\s*queueMsg\.ack\(\)\s*;\s*continue\s*;\s*\}/);
});
