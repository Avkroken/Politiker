-- Äldre OAuth-flöden kunde lämna flera account-rader som i praktiken tillhör
-- samma mailbox när e-posten skilde sig bara i skiftläge eller whitespace.
-- Om EN sådan rad redan är admin ska de övriga motsvarande raderna få samma
-- adminstatus. Detta skapar inga nya admin-identiteter för andra e-postadresser
-- och ändrar inte DEFAULT 0 för framtida konton.
UPDATE accounts AS target
SET is_admin = 1
WHERE target.is_admin = 0
  AND EXISTS (
    SELECT 1
    FROM accounts AS source
    WHERE source.id <> target.id
      AND source.is_admin = 1
      AND LOWER(TRIM(source.email)) = LOWER(TRIM(target.email))
  );
