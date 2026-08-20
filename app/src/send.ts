import { randomId } from "../../shared/crypto";
import { getRecipientsForAreas, countSentToday, countSentTodayForCredential, getMailCredential } from "./db";
import type { Env } from "./db";
import type { SendJobMessage } from "../../shared/types";

const STAGE_CHUNK_SIZE = 500;

interface StagedRecipient {
  email: string;
  name: string;
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

export async function enqueuePendingUserSendJobs(env: Env): Promise<void> {
  const { results: jobs } = await env.DB.prepare(
    `SELECT id, account_id, mail_credential_id FROM send_jobs
     WHERE status IN ('pending', 'sending')
       AND EXISTS (SELECT 1 FROM send_job_recipients r WHERE r.send_job_id = send_jobs.id AND r.status = 'pending')
     ORDER BY created_at`,
  ).all<{ id: string; account_id: string; mail_credential_id: string }>();

  for (const job of jobs) {
    const quota = await remainingQuotaForCredential(env, job.account_id, job.mail_credential_id);
    if (quota.remaining > 0) await enqueuePendingRecipientsForJob(env, job.id, quota.remaining);
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
  await env.DB.prepare(
    `INSERT INTO send_jobs (id, account_id, letter_id, mail_credential_id, total_recipients, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(sendJobId, accountId, input.letterId, input.mailCredentialId, recipients.length, Date.now())
    .run();

  await stageRecipients(env, sendJobId, recipients, input.subject);
  const quota = await remainingQuotaForCredential(env, accountId, input.mailCredentialId);
  await enqueuePendingRecipientsForJob(env, sendJobId, quota.remaining);

  return { sendJobId, totalRecipients: recipients.length };
}

export async function getSendJobsForAccount(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, total_recipients, sent_count, bounce_count, status, created_at, finished_at
     FROM send_jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(accountId)
    .all();
  return results;
}
