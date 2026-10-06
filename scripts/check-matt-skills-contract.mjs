import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error("Missing " + name);
  return args[index + 1];
}

const routingArg = option("--routing");
const catalogArg = option("--catalog");
const triageArg = option("--triage");
const routing = readFileSync(resolve(routingArg), "utf8");
const snapshot = readFileSync(resolve(catalogArg), "utf8");
const triage = readFileSync(resolve(triageArg), "utf8");

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

const invariantsStart = routing.indexOf("## Routing invariants");
const invariantsEnd = routing.indexOf("## Catalog drift gate", invariantsStart);
assert.notEqual(invariantsStart, -1, "routing contract is missing Routing invariants");
assert.notEqual(invariantsEnd, -1, "routing contract is missing Catalog drift gate after routing invariants");
const invariantSkills = [...routing.slice(invariantsStart, invariantsEnd).matchAll(/`([a-z][a-z0-9-]*)`/g)]
  .map((match) => match[1]);

for (const skill of invariantSkills) {
  assert.ok(skills.includes(skill), "routing invariant references unavailable skill: " + skill);
}

const lifecycleStart = routing.indexOf("## Canonical lifecycle routes");
const lifecycleEnd = routing.indexOf("## Full packaged catalog", lifecycleStart);
assert.notEqual(lifecycleStart, -1, "routing contract is missing Canonical lifecycle routes");
assert.notEqual(lifecycleEnd, -1, "routing contract is missing Full packaged catalog after lifecycle routes");
const lifecycleSkills = [...routing.slice(lifecycleStart, lifecycleEnd).matchAll(/`([^`]+)`/g)]
  .map((match) => match[1]);

for (const skill of lifecycleSkills) {
  assert.ok(skills.includes(skill), "canonical lifecycle route references unavailable skill: " + skill);
}

const expectedRoles = ["needs-info", "needs-triage", "ready-for-agent", "ready-for-human", "wontfix"].sort();
const triageRows = [...triage.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/gm)]
  .map((match) => ({ role: match[1], label: match[2], meaning: match[3].trim() }));
const triageRoles = triageRows.map((row) => row.role).sort();

assert.deepEqual(triageRoles, expectedRoles, "triage table must contain exactly the five canonical roles");
for (const row of triageRows) {
  assert.equal(row.label, row.role, "preferred label must match canonical role: " + row.role);
  assert.ok(row.meaning.length > 0, "triage role must have a meaning: " + row.role);
}

const driftStart = routing.indexOf("## Catalog drift gate");
const driftEnd = routing.indexOf("## Canonical lifecycle routes", driftStart);
assert.notEqual(driftStart, -1, "routing contract is missing Catalog drift gate");
assert.notEqual(driftEnd, -1, "routing contract is missing Canonical lifecycle routes after drift gate");
const drift = routing.slice(driftStart, driftEnd);

assert.ok(drift.includes("`" + catalogArg + "`"), "drift gate must name the configured catalog snapshot");
assert.match(drift, /skills:\/\/plugins\/matt-skills-curated\/\*/);
assert.match(drift, /\*\*Exact match:\*\*/);
assert.match(drift, /\*\*New, renamed, or removed runtime skills:\*\*/);
assert.match(drift, /\*\*Runtime catalog cannot be inspected:\*\*/);
assert.match(drift, /Repository CI cannot inspect the ChatGPT plugin runtime/);

console.log("Matt Skills contract OK: " + skills.length + " skills, 5 triage roles");
