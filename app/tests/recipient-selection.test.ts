import test from 'node:test';
import assert from 'node:assert/strict';
import { isIrrelevantRecipientRole } from '../src/db.ts';

test('irrelevant municipal and regional roles are rejected at send selection', () => {
  for (const role of ['Revisor', 'Nämndeman', 'Nämndemän', 'Vigselförrättare', 'Partnerskapsförrättare', 'God man', 'Gode män']) {
    assert.equal(isIrrelevantRecipientRole('kommun', role), true, role);
  }
  assert.equal(isIrrelevantRecipientRole('region', 'Nämndeman'), true);
  assert.equal(isIrrelevantRecipientRole('kommun', 'Ledamot'), false);
  assert.equal(isIrrelevantRecipientRole('eu', 'Nämndeman'), false);
  assert.equal(isIrrelevantRecipientRole('media', 'Politik'), false);
});
