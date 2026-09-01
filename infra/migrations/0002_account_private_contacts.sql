CREATE TABLE account_contact_lists (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id, name),
  UNIQUE(id, account_id)
);
CREATE INDEX idx_account_contact_lists_account ON account_contact_lists(account_id, name);

CREATE TABLE account_contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id, email),
  UNIQUE(id, account_id)
);
CREATE INDEX idx_account_contacts_account ON account_contacts(account_id, email);

CREATE TABLE account_contact_list_members (
  account_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, list_id, contact_id),
  FOREIGN KEY(list_id, account_id) REFERENCES account_contact_lists(id, account_id) ON DELETE CASCADE,
  FOREIGN KEY(contact_id, account_id) REFERENCES account_contacts(id, account_id) ON DELETE CASCADE
);
CREATE INDEX idx_account_contact_members_list ON account_contact_list_members(account_id, list_id);
CREATE INDEX idx_account_contact_members_contact ON account_contact_list_members(account_id, contact_id);
