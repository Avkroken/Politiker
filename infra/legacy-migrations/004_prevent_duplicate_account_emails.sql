-- Prevent future account duplication when the same mailbox is written with
-- different casing or surrounding whitespace. Existing rows are left untouched;
-- OAuth resolves them case-insensitively and reuses the existing account id.
CREATE TRIGGER IF NOT EXISTS accounts_email_nocase_insert
BEFORE INSERT ON accounts
WHEN EXISTS (
  SELECT 1 FROM accounts
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
)
BEGIN
  SELECT RAISE(ABORT, 'E-postadressen är redan registrerad');
END;

CREATE TRIGGER IF NOT EXISTS accounts_email_nocase_update
BEFORE UPDATE OF email ON accounts
WHEN EXISTS (
  SELECT 1 FROM accounts
  WHERE id <> OLD.id
    AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
)
BEGIN
  SELECT RAISE(ABORT, 'E-postadressen är redan registrerad');
END;
