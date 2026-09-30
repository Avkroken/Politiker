import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../../.github/workflows/agent-automerge.yml", import.meta.url), "utf8");

test("agent lifecycle caller reacts to PR, review, main and scheduled reconciliation events", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types: \[opened, edited, reopened, synchronize, ready_for_review\]/);
  assert.match(workflow, /pull_request_review:/);
  assert.match(workflow, /pull_request_review_comment:/);
  assert.match(workflow, /push:\n\s+branches: \[main\]/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("agent lifecycle caller delegates trust and merge gates to the central least-privilege policy", () => {
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /uses: Avkroken\/\.github\/\.github\/workflows\/agent-automerge-policy\.yml@main/);
  assert.doesNotMatch(workflow, /gh pr merge/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets:/);
  assert.doesNotMatch(workflow, /secrets\./);
});
