import type { Env } from "./index";
import { sendSmtpMail, escapeHtml } from "../../../shared/smtp";

// Skickar ett notismail till operatören via samma Gmail-konto som breven
// (env.GMAIL_EMAIL). Används när ett cron-jobb avbryts pga att Anthropics
// dagsbudget tagit slut — jobbet körs ändå igen i nästa schemalagda slot, så
// mailet är bara en heads-up, inget kräver åtgärd. Fel vid utskicket sväljs
// medvetet (loggas) så en trasig SMTP inte kan fälla hela cron-körningen.
export async function notifyBudgetExhausted(env: Env, job: string, detail: string): Promise<void> {
  if (!env.GMAIL_EMAIL || !env.GMAIL_PASSWORD) return;
  try {
    await sendSmtpMail(
      {
        host: "smtp.gmail.com",
        port: 587,
        user: env.GMAIL_EMAIL,
        password: env.GMAIL_PASSWORD,
        fromAddress: env.GMAIL_EMAIL,
      },
      {
        to: env.GMAIL_EMAIL,
        subject: `[politiker] Anthropic dagsbudget slut — ${job}`,
        html: `<p>Cron-jobbet <strong>${escapeHtml(job)}</strong> avbröts eftersom den dagliga Anthropic-budgeten tog slut.</p>
<p>${escapeHtml(detail)}</p>
<p>Ingen åtgärd krävs — jobbet körs automatiskt igen i nästa schemalagda slot.</p>`,
      },
    );
  } catch (e) {
    console.error(`notify: kunde inte skicka budgetnotis för ${job}:`, e);
  }
}
