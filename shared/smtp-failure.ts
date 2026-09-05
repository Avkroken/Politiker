function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSmtpAuthenticationFailure(error: unknown): boolean {
  return /^(?:Servern accepterade inte AUTH LOGIN|Användarnamn accepterades inte|Inloggning misslyckades)\b/i.test(errorMessage(error));
}

export function visibleSendJobError(status: string, error: string | null | undefined): string | null {
  if (!error) return null;
  const active = status === "pending" || status === "queued" || status === "sending";
  return active && isSmtpAuthenticationFailure(error) ? null : error;
}

export function isPermanentRecipientSmtpFailure(error: unknown): boolean {
  const message = errorMessage(error);
  if (!/^RCPT TO nekades\b/i.test(message)) return false;

  const normalized = message.toLowerCase();
  if (/\b5\.1\.\d{1,3}\b/.test(normalized)) return true;

  return [
    "user unknown",
    "unknown user",
    "no such user",
    "no such recipient",
    "recipient not found",
    "mailbox does not exist",
    "invalid recipient",
    "address rejected",
  ].some((marker) => normalized.includes(marker));
}
