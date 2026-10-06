import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error("Missing " + name);
  return args[index + 1];
}

const routing = readFileSync(resolve(option("--routing")), "utf8");
const snapshot = readFileSync(resolve(option("--catalog")), "utf8");
const triage = readFileSync(resolve(option("--triage")), "utf8");

const skills = snapshot
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

assert.ok(skills.length > 0, "skill snapshot is empty");
assert.deepEqual([...skills].sort(), skills, "skill snapshot must be alphabetically sorted");
assert.equal(new Set(skills).size, skills.length, "skill snapshot contains duplicates");

const catalogStart = routing.indexOf("## Full packaged catalog");
const catalogEnd = routing.indexOf("## Phase completion", catalogStart);
assert.notEqual(catalogStart, -1, "routing contract is missing Full packaged catalog");
assert.notEqual(catalogEnd, -1, "routing contract is missing Phase completion");
const routedSkills = [...routing.slice(catalogStart, catalogEnd).matchAll(/^- `([^`]+)`/gm)]
  .map((match) => match[1])
  .sort();

assert.deepEqual(routedSkills, skills, "routing catalog and snapshot must match exactly");

for (const role of ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"]) {
  assert.ok(triage.includes("`" + role + "`"), "triage mapping missing " + role);
}

assert.match(routing, /Catalog drift gate/);
assert.match(routing, /runtime/i);
console.log("Matt Skills contract OK: " + skills.length + " skills, 5 triage roles");
