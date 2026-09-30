import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../../.github/workflows/agent-automerge.yml", import.meta.url), "utf8");

test("agent auto-merge is restricted to trusted same-repository codex PRs", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types: \[opened, reopened, synchronize, ready_for_review\]/);
  assert.match(workflow, /user\.login == 'gamnacken\[bot\]'/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /base\.ref == github\.event\.repository\.default_branch/);
  assert.match(workflow, /startsWith\(github\.event\.pull_request\.head\.ref, 'codex\/'\)/);
  assert.match(workflow, /pull_request\.draft == false/);
});

test("agent auto-merge has only the write permissions needed for native merge", () => {
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /gh pr merge --auto --merge/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets\.(?!GITHUB_TOKEN)/);
});
