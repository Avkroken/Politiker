import { randomId } from "../../shared/crypto";
import { escapeHtml } from "../../shared/html";
import { sendSystemMail } from "./auth";
import type { Env } from "./db";

// Tak för hur många NYA automatiska felnotiser som får mejlas per dygn.
// Överskjutande fel sparas och räknas fortfarande i D1.
const MAX_NEW_AUTO_ERROR_EMAILS_PER_DAY = 20;

// Automatiskt rapporterat klientfel → D1 + e-postnotis. Deduplicerar på en
// signatur (felmeddelande + fil:rad) så återkommande fel räknas upp på samma
// rad och har ett dygnstak mot mejlspam. Best effort: får aldrig kasta vidare.
export async function reportClientError(
  env: Env,
  input: { message: string; stack?: string; url?: string },
): Promise<{ reported: boolean }> {
  const message = (input.message || "okänt fel").slice(0, 300);
  const stack = (input.stack ?? "").slice(0, 2000);
  const frame = stack.match(/(\w+\.(?:js|ts|css)):(\d+)/);
  const signature = `${message}|${frame ? `${frame[1]}:${frame[2]}` : ""}`;
  const now = Date.now();

  const existing = await env.DB.prepare("SELECT 1 FROM client_errors WHERE signature = ?")
    .bind(signature)
    .first();
  if (existing) {
    // Känd bugg — räkna bara upp förekomsten, skapa ingen ny issue.
    await env.DB.prepare("UPDATE client_errors SET count = count + 1, last_seen = ? WHERE signature = ?")
      .bind(now, signature)
      .run();
    return { reported: false };
  }

  await env.DB.prepare("INSERT INTO client_errors (signature, message, count, first_seen, last_seen) VALUES (?, ?, 1, ?, ?)")
    .bind(signature, message, now, now)
    .run();

  const since24h = now - 24 * 60 * 60 * 1000;
  const day = await env.DB.prepare(
    "SELECT COUNT(*) as n FROM client_errors WHERE email_notified_at >= ?",
  )
    .bind(since24h)
    .first<{ n: number }>();
  if ((day?.n ?? 0) > MAX_NEW_AUTO_ERROR_EMAILS_PER_DAY) return { reported: false };

  try {
    const subject = `Automatiskt klientfel — ${message.slice(0, 80)}`;
    const html = [
      "<p>Automatiskt rapporterat JavaScript-fel i produktion.</p>",
      `<p><strong>Fel:</strong> ${escapeHtml(message)}</p>`,
      input.url ? `<p><strong>Sida:</strong> ${escapeHtml(input.url)}</p>` : "",
      stack ? `<pre>${escapeHtml(stack)}</pre>` : "",
    ].join("");
    await sendSystemMail(env, env.FEEDBACK_NOTIFY_EMAIL, subject, html);
    await env.DB.prepare("UPDATE client_errors SET email_notified_at = ? WHERE signature = ?")
      .bind(now, signature)
      .run();
    if (env.ERROR_FIXER_INBOX) {
      await sendSystemMail(env, env.ERROR_FIXER_INBOX, subject, html).catch(() => {});
    }
    return { reported: true };
  } catch {
    // Best effort — felet är redan sparat i client_errors.
  }
  return { reported: false };
}

interface WorkerError {
  method: string;
  endpoint: string;
  status: number;
  error_message: string;
  created_at: number;
}

export async function submitFeedback(
  env: Env,
  input: {
    accountId: string | null;
    message: string;
    context?: Record<string, unknown>;
    type?: "bug" | "contact";
    replyTo?: string;
  },
): Promise<{ received: true }> {
  const isContact = input.type === "contact";

  // Hämta serverfel för kontot (senaste 48h) — ger auto-triage-boten
  // serverkontext utan att exponera hemligheter (endpoint=pathname, ingen body).
  const since48h = Date.now() - 48 * 60 * 60 * 1000;
  const serverErrors: WorkerError[] = [];
  if (input.accountId) {
    const { results } = await env.DB.prepare(
      "SELECT method, endpoint, status, error_message, created_at FROM worker_errors WHERE account_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20",
    )
      .bind(input.accountId, since48h)
      .all<WorkerError>();
    serverErrors.push(...results);
  }

  // Rensa gamla rader (>48h) — best effort, piggybacks på befintlig skrivning.
  env.DB.prepare("DELETE FROM worker_errors WHERE created_at < ?").bind(since48h).run().catch(() => {});

  await env.DB.prepare(
    "INSERT INTO feedback (id, account_id, message, github_issue_url, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(randomId(), input.accountId, input.message, null, Date.now())
    .run();

  const mailSubject = isContact ? "Ny kontaktfråga — politiker.denied.se" : "Ny feedback — politiker.denied.se";
  const mailHtml = [
    input.replyTo ? `<p>Svar önskas till: ${escapeHtml(input.replyTo)}</p>` : "",
    `<p>${escapeHtml(input.message)}</p>`,
    `<p><strong>Konto:</strong> ${escapeHtml(input.accountId ?? "ej inloggad")}</p>`,
    input.context ? `<p><strong>Klientkontext:</strong></p><pre>${escapeHtml(JSON.stringify(input.context, null, 2))}</pre>` : "",
    serverErrors.length > 0
      ? `<p><strong>Serverfel senaste 48 timmarna:</strong></p><pre>${escapeHtml(serverErrors.map((error) => {
          const timestamp = new Date(error.created_at).toISOString();
          return `${timestamp}  ${error.method} ${error.endpoint}  ${error.status}  ${error.error_message}`;
        }).join("\n"))}</pre>`
      : "",
  ].join("");

  await sendSystemMail(env, env.FEEDBACK_NOTIFY_EMAIL, mailSubject, mailHtml);
  // Skicka även till felrättningsinkorgen så att automatiseringen kan agera.
  if (!isContact && env.ERROR_FIXER_INBOX) {
    await sendSystemMail(env, env.ERROR_FIXER_INBOX, mailSubject, mailHtml).catch(() => {});
  }

  return { received: true };
}
