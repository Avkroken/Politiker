import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isPermanentRecipientSmtpFailure,
  isSmtpAuthenticationFailure,
} from "../../shared/smtp-failure.ts";

const queueSource = readFileSync(new URL("../src/send-queue.ts", import.meta.url), "utf8");

test("SMTP authentication failures are account-scoped, not recipient bounces", () => {
  assert.equal(isSmtpAuthenticationFailure(new Error("Inloggning misslyckades (535): 535 5.7.8 Error: authentication failed")), true);
  assert.equal(isSmtpAuthenticationFailure(new Error("RCPT TO nekades (550): 550 5.1.1 User unknown")), false);
});

test("only permanent recipient rejections mark an address as dead", () => {
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (550): 550 5.1.1 User unknown")), true);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (550): 550 5.7.1 Policy rejection")), false);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("RCPT TO nekades (451): 451 4.2.0 Temporary failure")), false);
  assert.equal(isPermanentRecipientSmtpFailure(new Error("Inloggning misslyckades (535): authentication failed")), false);
});

test("queue aborts on SMTP auth failure without counting it as sent or poisoning the recipient", () => {
  assert.match(queueSource, /if\(isSmtpAuthenticationFailure\(err\)\)\{await recordBlockingSendError\(env,m,errorMsg\);queueMsg\.ack\(\);aborted=true;continue;\}/);
  assert.match(queueSource, /\.bind\(sentCount,bounceCount,aborted\?"aborted":"sending",sendJobId\)/);
  assert.match(queueSource, /else if\(markRecipientDead\)await env\.DB\.prepare\("UPDATE politicians SET verification_status='dead_via_send'/);
});
