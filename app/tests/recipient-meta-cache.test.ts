import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'public', 'recipient-meta.js'), 'utf8');

test('recipient metadata is loaded directly from D1-backed API endpoints', async () => {
  const state = { areas: null, parties: null, roles: null };
  const calls: string[] = [];
  const responses: Record<string, unknown[]> = {
    '/api/areas': [{ area_name: 'Testkommun' }],
    '/api/parties': [{ party: 'Testparti' }],
    '/api/roles': [{ role: 'Ledamot' }],
  };
  const context = {
    state,
    api: async (path: string) => { calls.push(path); return responses[path]; },
  };

  runInNewContext(source, context);
  await (context as typeof context & { ensureRecipientData: () => Promise<void> }).ensureRecipientData();

  assert.deepEqual(calls, ['/api/areas', '/api/parties', '/api/roles']);
  assert.deepEqual(state.areas, responses['/api/areas']);
  assert.deepEqual(state.parties, responses['/api/parties']);
  assert.deepEqual(state.roles, responses['/api/roles']);
  assert.doesNotMatch(source, /recipient-meta\.json/);
  assert.doesNotMatch(source, /localStorage/);
});
