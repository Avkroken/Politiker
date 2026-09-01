import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeImportedContacts, normalizePrivateContactInput } from '../src/private-contacts.ts';
import { parseIncludedRecipient } from '../src/db.ts';

const here = dirname(fileURLToPath(import.meta.url));

test('private contacts normalize email and sanitize display names', () => {
  assert.deepEqual(
    normalizePrivateContactInput({ email: '  ANNA@Example.SE ', name: 'Anna\r\nAndersson' }),
    { email: 'anna@example.se', name: 'Anna  Andersson' },
  );
  assert.throws(() => normalizePrivateContactInput({ email: 'inte-en-adress' }), /Ogiltig e-postadress/);
});

test('private contact imports are account-list safe inputs and deduplicate emails', () => {
  assert.deepEqual(
    normalizeImportedContacts([
      { email: 'ANNA@example.se' },
      { email: 'anna@example.se', name: 'Anna Andersson' },
      { email: 'erik@example.se', name: 'Erik' },
    ]),
    [
      { email: 'anna@example.se', name: 'Anna Andersson' },
      { email: 'erik@example.se', name: 'Erik' },
    ],
  );
});

test('explicit recipients support both raw addresses and display names', () => {
  assert.deepEqual(parseIncludedRecipient('EXTRA@example.se'), { email: 'extra@example.se', name: '' });
  assert.deepEqual(parseIncludedRecipient('Extra Person <EXTRA@example.se>'), { email: 'extra@example.se', name: 'Extra Person' });
  assert.equal(parseIncludedRecipient('not-an-email'), null);
});

test('private contact schema enforces account ownership on lists, contacts, and membership', () => {
  const migration = readFileSync(join(here, '..', '..', 'infra', 'migrations', '0002_account_private_contacts.sql'), 'utf8');
  assert.match(migration, /account_contact_lists[\s\S]*account_id TEXT NOT NULL REFERENCES accounts\(id\)/);
  assert.match(migration, /account_contacts[\s\S]*account_id TEXT NOT NULL REFERENCES accounts\(id\)/);
  assert.match(migration, /FOREIGN KEY\(list_id, account_id\) REFERENCES account_contact_lists\(id, account_id\)/);
  assert.match(migration, /FOREIGN KEY\(contact_id, account_id\) REFERENCES account_contacts\(id, account_id\)/);
});
