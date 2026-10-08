import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../../.github/workflows/agent-automerge.yml", import.meta.url), "utf8");
const signalWorkflow = await readFile(new URL("../../.github/workflows/agent-lifecycle-signal.yml", import.meta.url), "utf8");

test("agent lifecycle caller reacts to PR, checks, main and scheduled reconciliation events", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types: \[opened, edited, reopened, synchronize, ready_for_review\]/);
  assert.doesNotMatch(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /pull_request_review_comment:/);
  assert.match(workflow, /workflow_run:\n\s+workflows: \["Agent lifecycle signal"\]\n\s+types: \[completed\]/);
  assert.match(signalWorkflow, /pull_request_review:/);
  assert.match(signalWorkflow, /pull_request_review_comment:/);
  assert.match(signalWorkflow, /permissions:\s*\{\}/);
  assert.match(workflow, /check_run:\n\s+types: \[completed\]/);
  assert.match(workflow, /push:\n\s+branches: \[main\]/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("agent lifecycle caller delegates trust and merge gates to the repository-local least-privilege policy", () => {
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(workflow, /checks: read/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/agent-automerge-policy\.yml/);
  assert.doesNotMatch(workflow, /gh pr merge/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets:/);
  assert.doesNotMatch(workflow, /secrets\./);
});
