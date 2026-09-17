import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sendSource = readFileSync(new URL("../src/send.ts", import.meta.url), "utf8");
const queueSource = readFileSync(new URL("../src/send-queue.ts", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../../shared/types.ts", import.meta.url), "utf8");

test("queued messages carry the enqueue timestamp as an attempt generation", () => {
  assert.match(typesSource, /queuedAt\?:\s*number/);
  assert.match(sendSource, /const queuedAt\s*=\s*Date\.now\(\)/);
  assert.match(sendSource, /SET status = 'queued', queued_at = \?[\s\S]*?\.bind\(queuedAt,/);
  assert.match(sendSource, /queuedAt,/);
});

test("cron releases stale queued recipients before re-enqueueing", () => {
  assert.match(sendSource, /const STALE_QUEUED_MS\s*=\s*2\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(sendSource, /export async function recoverStaleQueuedRecipients[\s\S]*?r\.status = 'queued'[\s\S]*?r\.queued_at <= \?[\s\S]*?j\.status IN \('pending', 'sending'\)/);
  assert.match(sendSource, /SET status = 'pending', queued_at = NULL, error = NULL/);
  assert.match(sendSource, /export async function enqueuePendingUserSendJobs[\s\S]*?await recoverStaleQueuedRecipients\(env\)/);
});

test("consumer rejects legacy or superseded queue attempts", () => {
  assert.match(queueSource, /SELECT status,queued_at FROM send_job_recipients/);
  assert.match(queueSource, /m\.queuedAt==null/);
  assert.match(queueSource, /staged\.queued_at!==m\.queuedAt/);
  assert.match(queueSource, /maySendQueuedRecipient\(env,sendJobId,m\.recipientEmail,m\.queuedAt\)/);
  assert.match(queueSource, /current\.queued_at!==m\.queuedAt/);
});
