import { randomId } from "../../shared/crypto";
import { getRecipientsForAreas, countSentToday, countSentTodayForCredential, getMailCredential } from "./db";
import type { Env } from "./db";
import type { SendJobMessage } from "../../shared/types";

const STAGE_CHUNK_SIZE = 500;

interface StagedRecipient {
  email: string;
  name: string;
}

interface SendRateInput {
  dailyLimit?: number | null;
  switchAfterDays?: number | null;
  nextDailyLimit?: number | null;
}

function parseRateInput(input: SendRateInput, now = Date.now()) {
  const normalize = (value: number | null | undefined, label: string): number | null => {
    if (value == null) return null;
    if (!Number.isInteger(value) || value < 1 || value > 10_000) {
      throw new Error(`${label} måste vara ett heltal mellan 1 och 10 000`);
    }
    return value;
  };
  const dailyLimit = normalize(input.dailyLimit, "Gräns nu");
  const nextDailyLimit = normalize(input.nextDailyLimit, "Gräns därefter");
  let limitSwitchAt: number | null = null;
  if (nextDailyLimit != null) {
    if (!Number.isInteger(input.switchAfterDays) || (input.switchAfterDays ?? 0) < 1 || (input.switchAfterDays ?? 0) > 365) {
      throw new Error("Antal dagar måste vara ett heltal mellan 1 och 365");
    }
    limitSwitchAt = now + Number(input.switchAfterDays) * 24 * 60 * 60 * 1000;
  }
  return { dailyLimit, nextDailyLimit, limitSwitchAt };
}

function effectiveJobDailyLimit(job: { daily_limit: number | null; next_daily_limit: number | null; limit_switch_at: number | null }, now = Date.now()) {
  if (job.next_daily_limit != null && job.limit_switch_at != null && now >= job.limit_switch_at) return job.next_daily_limit;
  return job.daily_limit;
}

function stableRecipientHash(seed: string, email: string): number {
  let hash = 2166136261;
  const value = `${seed}:${email.toLocaleLowerCase("sv-SE")}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function prioritizeRecipients(env: Env, sendJobId: string, recipients: StagedRecipient[]): Promise<StagedRecipient[]> {
  const priorityByEmail = new Map<string, number>();
  for (let i = 0; i < recipients.length; i += STAGE_CHUNK_SIZE) {
    const emails = recipients.slice(i, i + STAGE_CHUNK_SIZE).map((r) => r.email.trim().toLocaleLowerCase("sv-SE"));
    const { results } = await env.DB.prepare(`
      SELECT lower(trim(email)) AS email_key,
             MIN(CASE area_type
               WHEN 'eu' THEN 1
               WHEN 'regering' THEN 2
               WHEN 'riksdag' THEN 3
               WHEN 'media' THEN 4
               WHEN 'region' THEN 5
               WHEN 'kommun' THEN 6
               ELSE 7
             END) AS priority
      FROM politicians
      WHERE lower(trim(email)) IN (SELECT lower(trim(value)) FROM json_each(?))
      GROUP BY lower(trim(email))
    `).bind(JSON.stringify(emails)).all<{ email_key: string; priority: number }>();
    for (const row of results) priorityByEmail.set(row.email_key, Number(row.priority));
  }

  return [...recipients].sort((a, b) => {
    const aKey = a.email.trim().toLocaleLowerCase("sv-SE");
    const bKey = b.email.trim().toLocaleLowerCase("sv-SE");
    const aPriority = priorityByEmail.get(aKey) ?? 7;
    const bPriority = priorityByEmail.get(bKey) ?? 7;
    if (aPriority !== bPriority) return aPriority - bPriority;

    // Kommunpolitiker ska få en jämn spridning över landet i stället för att
    // stora kommuner eller alfabetisk ordning alltid töms först. Hashen är
    // stabil per utskick så retries/omstarter aldrig kastar om kön.
    if (aPriority === 6) {
      return stableRecipientHash(sendJobId, aKey) - stableRecipientHash(sendJobId, bKey);
    }
    return aKey.localeCompare(bKey, "sv-SE");
  });
}

export async function maySendQueuedRecipient(env: Env, sendJobId: string, recipientEmail: string): Promise<boolean> {
  const job = await env.DB.prepare(
    "SELECT daily_limit, next_daily_limit, limit_switch_at FROM send_jobs WHERE id = ?",
  ).bind(sendJobId).first<{ daily_limit: number | null; next_daily_limit: number | null; limit_switch_at: number | null }>();
  if (!job) return false;
  const dailyLimit = effectiveJobDailyLimit(job);
  if (dailyLimit == null) return true;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM send_log WHERE send_job_id = ? AND sent_at >= ? AND status = 'ok'",
  ).bind(sendJobId, startOfDay.getTime()).first<{ n: number }>();
  const available = Math.max(0, dailyLimit - (sent?.n ?? 0));
  const allowed = available > 0
    ? await env.DB.prepare(
      `SELECT 1 AS allowed FROM (
         SELECT recipient_email FROM send_job_recipients
         WHERE send_job_id = ? AND status = 'queued'
         ORDER BY queued_at, rowid LIMIT ?
       ) WHERE recipient_email = ? COLLATE NOCASE`,
    ).bind(sendJobId, available, recipientEmail).first<{ allowed: number }>()
    : null;
  if (allowed) return true;

  await env.DB.prepare(
    `UPDATE send_job_recipients SET status = 'pending', queued_at = NULL
     WHERE send_job_id = ? AND recipient_email = ? AND status = 'queued'`,
  ).bind(sendJobId, recipientEmail).run();
  return false;
}

async function remainingQuotaForCredential(
  env: Env,
  accountId: string,
  mailCredentialId: string,
): Promise<{ remaining: number; label: string }> {
  const account = await env.DB.prepare("SELECT daily_send_cap FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ daily_send_cap: number }>();
  if (!account) throw new Error("Konto saknas");

  const credential = await getMailCredential(env.DB, mailCredentialId);
  if (!credential || credential.account_id !== accountId) throw new Error("Mailkoppling saknas");

  if (credential.daily_cap != null) {
    const sentViaCredentialToday = await countSentTodayForCredential(env.DB, mailCredentialId);
    const queuedViaCredential = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM send_job_recipients r
       JOIN send_jobs j ON j.id = r.send_job_id
       WHERE j.mail_credential_id = ? AND r.status = 'queued'`,
    ).bind(mailCredentialId).first<{ n: number }>();
    return {
      remaining: Math.max(0, Number(credential.daily_cap) - sentViaCredentialToday - (queuedViaCredential?.n ?? 0)),
      label: `dygnsgränsen för detta mailkonto (${credential.daily_cap}/dygn)`,
    };
  }

  // Okänd/generisk leverantör saknar ett säkert leverantörstak. Där används
  // kontots försiktiga reservgräns i stället.
  const sentToday = await countSentToday(env.DB, accountId);
  const queued = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM send_job_recipients r
     JOIN send_jobs j ON j.id = r.send_job_id
     WHERE j.account_id = ? AND r.status = 'queued'`,
  ).bind(accountId).first<{ n: number }>();
  return {
    remaining: Math.max(0, account.daily_send_cap - sentToday - (queued?.n ?? 0)),
    label: `kontots dygnsgräns (${account.daily_send_cap}/dygn)`,
  };
}

async function stageRecipients(
  env: Env,
  sendJobId: string,
  recipients: StagedRecipient[],
  subject?: string,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < recipients.length; i += STAGE_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + STAGE_CHUNK_SIZE);
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO send_job_recipients
         (send_job_id, recipient_email, recipient_name, subject)
       SELECT ?, json_extract(value, '$.email'), json_extract(value, '$.name'), ?
       FROM json_each(?)`,
    ).bind(sendJobId, subject ?? null, JSON.stringify(chunk)));
  }
  if (statements.length > 0) await env.DB.batch(statements);
}

export async function enqueuePendingRecipientsForJob(env: Env, sendJobId: string, limit: number): Promise<number> {
  if (limit <= 0) return 0;
  const job = await env.DB.prepare(
    `SELECT account_id, mail_credential_id FROM send_jobs
     WHERE id = ? AND status IN ('pending', 'sending')`,
  ).bind(sendJobId).first<{ account_id: string; mail_credential_id: string }>();
  if (!job) return 0;

  const { results } = await env.DB.prepare(
    `SELECT recipient_email, recipient_name, subject
     FROM send_job_recipients
     WHERE send_job_id = ? AND status = 'pending'
     ORDER BY rowid LIMIT ?`,
  ).bind(sendJobId, limit).all<{ recipient_email: string; recipient_name: string; subject: string | null }>();

  let queued = 0;
  for (const recipient of results) {
    const claimed = await env.DB.prepare(
      `UPDATE send_job_recipients SET status = 'queued', queued_at = ?
       WHERE send_job_id = ? AND recipient_email = ? AND status = 'pending'`,
    ).bind(Date.now(), sendJobId, recipient.recipient_email).run();
    if (claimed.meta.changes !== 1) continue;

    const message: SendJobMessage = {
      sendJobId,
      accountId: job.account_id,
      mailCredentialId: job.mail_credential_id,
      recipientEmail: recipient.recipient_email,
      recipientName: recipient.recipient_name,
      subject: recipient.subject ?? undefined,
    };
    try {
      await env.SEND_QUEUE.send(message);
      queued++;
    } catch (error) {
      await env.DB.prepare(
        `UPDATE send_job_recipients SET status = 'pending', queued_at = NULL, error = ?
         WHERE send_job_id = ? AND recipient_email = ? AND status = 'queued'`,
      ).bind(String(error).slice(0, 300), sendJobId, recipient.recipient_email).run();
      throw error;
    }
  }
  if (queued > 0) {
    await env.DB.prepare("UPDATE send_jobs SET status = 'sending' WHERE id = ? AND status = 'pending'")
      .bind(sendJobId)
      .run();
  }
  return queued;
}

async function remainingJobQuota(env: Env, sendJobId: string): Promise<number | null> {
  const job = await env.DB.prepare(
    "SELECT daily_limit, next_daily_limit, limit_switch_at FROM send_jobs WHERE id = ?",
  ).bind(sendJobId).first<{ daily_limit: number | null; next_daily_limit: number | null; limit_switch_at: number | null }>();
  if (!job) return 0;
  const dailyLimit = effectiveJobDailyLimit(job);
  if (dailyLimit == null) return null;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM send_log WHERE send_job_id = ? AND sent_at >= ? AND status = 'ok'",
  ).bind(sendJobId, startOfDay.getTime()).first<{ n: number }>();
  const queued = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM send_job_recipients WHERE send_job_id = ? AND status = 'queued'",
  ).bind(sendJobId).first<{ n: number }>();
  return Math.max(0, dailyLimit - (sent?.n ?? 0) - (queued?.n ?? 0));
}

async function enqueueWithinLimits(env: Env, sendJobId: string, providerRemaining: number): Promise<number> {
  const jobRemaining = await remainingJobQuota(env, sendJobId);
  return enqueuePendingRecipientsForJob(env, sendJobId, Math.min(providerRemaining, jobRemaining ?? providerRemaining));
}

export async function enqueuePendingUserSendJobs(env: Env): Promise<void> {
  const { results: jobs } = await env.DB.prepare(
    `SELECT id, account_id, mail_credential_id FROM send_jobs
     WHERE status IN ('pending', 'sending')
       AND EXISTS (SELECT 1 FROM send_job_recipients r WHERE r.send_job_id = send_jobs.id AND r.status = 'pending')
     ORDER BY created_at`,
  ).all<{ id: string; account_id: string; mail_credential_id: string }>();

  for (const job of jobs) {
    const quota = await remainingQuotaForCredential(env, job.account_id, job.mail_credential_id);
    if (quota.remaining > 0) await enqueueWithinLimits(env, job.id, quota.remaining);
  }
}

export async function createAndEnqueueSendJob(
  env: Env,
  accountId: string,
  input: {
    letterId: string;
    subject?: string;
    mailCredentialId: string;
    areaNames: string[];
    excludeParties?: string[];
    excludeEmails?: string[];
    includeRoles?: string[];
    includeEmails?: string[];
    dailyLimit?: number | null;
    switchAfterDays?: number | null;
    nextDailyLimit?: number | null;
  },
): Promise<{ sendJobId: string; totalRecipients: number }> {
  const account = await env.DB.prepare("SELECT daily_send_cap FROM accounts WHERE id = ?").bind(accountId).first<{ daily_send_cap: number }>();
  if (!account) throw new Error("Konto saknas");

  const credential = await getMailCredential(env.DB, input.mailCredentialId);
  if (!credential || credential.account_id !== accountId) throw new Error("Mailkoppling saknas");

  const recipients = await getRecipientsForAreas(
    env.DB,
    input.areaNames,
    input.excludeParties ?? [],
    input.excludeEmails ?? [],
    input.includeRoles ?? [],
    input.includeEmails ?? [],
  );
  if (recipients.length === 0) throw new Error("Inga mottagare matchar valda filter — välj område, befattning eller enskilda politiker");

  const sendJobId = randomId();
  const orderedRecipients = await prioritizeRecipients(env, sendJobId, recipients);
  const rate = parseRateInput(input);
  await env.DB.prepare(
    `INSERT INTO send_jobs
       (id, account_id, letter_id, mail_credential_id, total_recipients, status,
        daily_limit, next_daily_limit, limit_switch_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(sendJobId, accountId, input.letterId, input.mailCredentialId, recipients.length,
      rate.dailyLimit, rate.nextDailyLimit, rate.limitSwitchAt, Date.now())
    .run();

  await stageRecipients(env, sendJobId, orderedRecipients, input.subject);
  const quota = await remainingQuotaForCredential(env, accountId, input.mailCredentialId);
  await enqueueWithinLimits(env, sendJobId, quota.remaining);

  return { sendJobId, totalRecipients: recipients.length };
}

export async function getSendJobsForAccount(env: Env, accountId: string) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT id, letter_id, total_recipients, sent_count, bounce_count, status,
            CASE WHEN next_daily_limit IS NOT NULL AND limit_switch_at <= ?
                 THEN next_daily_limit ELSE daily_limit END AS daily_limit,
            CASE WHEN next_daily_limit IS NOT NULL AND limit_switch_at <= ?
                 THEN NULL ELSE next_daily_limit END AS next_daily_limit,
            CASE WHEN next_daily_limit IS NOT NULL AND limit_switch_at <= ?
                 THEN NULL ELSE limit_switch_at END AS limit_switch_at,
            created_at, finished_at
     FROM send_jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(now, now, now, accountId)
    .all();
  return results;
}

export async function updateSendJobRate(
  env: Env,
  accountId: string,
  sendJobId: string,
  input: SendRateInput,
): Promise<{ dailyLimit: number | null; nextDailyLimit: number | null; limitSwitchAt: number | null }> {
  const job = await env.DB.prepare(
    "SELECT id, mail_credential_id, status FROM send_jobs WHERE id = ? AND account_id = ?",
  ).bind(sendJobId, accountId).first<{ id: string; mail_credential_id: string; status: string }>();
  if (!job) throw new Error("Utskicket hittades inte");
  if (!["pending", "sending"].includes(job.status)) throw new Error("Takt kan bara ändras för ett pågående utskick");

  const rate = parseRateInput(input);
  await env.DB.prepare(
    "UPDATE send_jobs SET daily_limit = ?, next_daily_limit = ?, limit_switch_at = ? WHERE id = ? AND account_id = ?",
  ).bind(rate.dailyLimit, rate.nextDailyLimit, rate.limitSwitchAt, sendJobId, accountId).run();

  const providerQuota = await remainingQuotaForCredential(env, accountId, job.mail_credential_id);
  if (providerQuota.remaining > 0) await enqueueWithinLimits(env, sendJobId, providerQuota.remaining);
  return rate;
}
