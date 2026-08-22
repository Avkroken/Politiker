-- En lyckad lösenordsåterställning konsumerar reset_token genom att sätta den
-- till NULL. Stäng samtidigt av TOTP så en borttappad autentiseringsapp inte
-- kan låsa ute användaren direkt efter att återställningsmailet bevisat
-- kontroll över kontots e-postadress.
CREATE TRIGGER IF NOT EXISTS disable_totp_after_password_reset
AFTER UPDATE OF reset_token ON accounts
WHEN OLD.reset_token IS NOT NULL AND NEW.reset_token IS NULL
BEGIN
  UPDATE accounts
  SET totp_enabled = 0,
      totp_secret = NULL
  WHERE id = NEW.id;
END;
