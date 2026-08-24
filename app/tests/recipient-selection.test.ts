import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'src', 'db.ts'), 'utf8');

test('irrelevant municipal and regional roles are rejected at send selection', () => {
  assert.match(source, /isIrrelevantRecipientRole/);
  assert.match(source, /r\.includes\("revisor"\)/);
  assert.match(source, /r\.includes\("nämndeman"\)/);
  assert.match(source, /r\.includes\("vigselförrätt"\)/);
  assert.match(source, /r===\"god man\"/);
  assert.match(source, /SELECT name,email,area_name,area_type,role FROM politicians/);
  assert.match(source, /if\(!isIrrelevantRecipientRole\(r\.area_type,r\.role\)\)byEmail\.set/);
});
