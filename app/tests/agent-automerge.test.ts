import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../../.github/workflows/agent-automerge.yml", import.meta.url), "utf8");

test("agent auto-merge delegates to the central trusted policy", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types: \[opened, reopened, synchronize, ready_for_review\]/);
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(workflow, /uses: Avkroken\/\.github\/\.github\/workflows\/agent-automerge-policy\.yml@main/);
});

test("agent auto-merge caller grants only the required write permissions", () => {
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.doesNotMatch(workflow, /gh pr merge/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets:/);
});
