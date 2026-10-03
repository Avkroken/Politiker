import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../../.github/workflows/agent-automerge.yml", import.meta.url), "utf8");

test("agent lifecycle caller reacts to PR, checks, main and scheduled reconciliation events", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types: \[opened, edited, reopened, synchronize, ready_for_review\]/);
  assert.doesNotMatch(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /pull_request_review_comment:/);
  assert.match(workflow, /check_run:\n\s+types: \[completed\]/);
  assert.match(workflow, /push:\n\s+branches: \[main\]/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("agent lifecycle caller delegates trust and merge gates to the central least-privilege policy", () => {
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(workflow, /checks: read/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /uses: Avkroken\/\.github\/\.github\/workflows\/agent-automerge-policy\.yml@e853bde6e0e8c88e8d8df2709cf3e2d61ddc396c/);
  assert.doesNotMatch(workflow, /gh pr merge/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets:/);
  assert.doesNotMatch(workflow, /secrets\./);
});
