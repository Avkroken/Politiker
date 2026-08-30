import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'public', 'recipient-meta.js'), 'utf8');

test('recipient metadata is revalidated instead of persisted in localStorage', () => {
  assert.match(source, /cache:'no-cache'/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /RECIPIENT_META_TTL_MS/);
});

test('empty static metadata falls back to authenticated D1 endpoints', () => {
  assert.match(source, /if\(meta\.areas\.length\)/);
  assert.match(source, /api\('\/api\/areas'\)/);
  assert.match(source, /api\('\/api\/parties'\)/);
  assert.match(source, /api\('\/api\/roles'\)/);
});
