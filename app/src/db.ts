import { randomId } from "../../shared/crypto";
import { canonicalRole } from "./roles";
import type { EmailSendBinding } from "../../shared/types";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  SEND_QUEUE: Queue;
  ASSETS: Fetcher;
  ATTACHMENTS: R2Bucket;
  MAIL_CRED_KEY: string;
  SYSTEM_SMTP_HOST: string;
  SYSTEM_SMTP_PORT: string;
  SYSTEM_SMTP_USER: string;
  SYSTEM_SMTP_PASSWORD: string;
  SYSTEM_FROM_ADDRESS: string;
  FEEDBACK_NOTIFY_EMAIL: string;
  ERROR_FIXER_INBOX?: string;
  OAUTH_GOOGLE_CLIENT_ID?: string;
  OAUTH_GOOGLE_CLIENT_SECRET?: string;
  OAUTH_GITHUB_CLIENT_ID?: string;
  OAUTH_GITHUB_CLIENT_SECRET?: string;
  OAUTH_MICROSOFT_CLIENT_ID?: string;
  OAUTH_MICROSOFT_CLIENT_SECRET?: string;
  VISITOR_SALT?: string;
  TURNSTILE_SECRET?: string;
  EMAIL?: EmailSendBinding;
  RESEND_API_KEY?: string;
  RATE_LIMITER: DurableObjectNamespace;
}

export async function getAccountByEmail(db: D1Database, email: string) {
  return db.prepare("SELECT * FROM accounts WHERE email = ?").bind(email).first();
}

export async function getAccountById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).first();
}

export async function deleteAccount(env: Env, accountId: string): Promise<void> {
  const target = await env.DB.prepare("SELECT is_admin FROM accounts WHERE id = ?").bind(accountId).first<{ is_admin: number }>();
  if (target?.is_admin) {
    const row = await env.DB.prepare("SELECT COUNT(*) as n FROM accounts WHERE is_admin = 1").first<{ n: number }>();
    if ((row?.n ?? 0) <= 1) throw new Error("Kan inte radera det sista admin-kontot — utse en annan administratör först");
  }

  const { results: attachmentRows } = await env.DB.prepare(
    "SELECT r2_key FROM letter_attachments WHERE letter_id IN (SELECT id FROM letters WHERE account_id = ?)",
  ).bind(accountId).all<{ r2_key: string }>();

  await env.DB.batch([
    env.DB.prepare("DELETE FROM letter_attachments WHERE letter_id IN (SELECT id FROM letters WHERE account_id = ?)").bind(accountId),
    env.DB.prepare("DELETE FROM send_log WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM send_jobs WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM letters WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM mail_credentials WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM oauth_identities WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM api_keys WHERE account_id = ?").bind(accountId),
    env.DB.prepare("UPDATE feedback SET account_id = NULL WHERE account_id = ?").bind(accountId),
    env.DB.prepare("UPDATE worker_errors SET account_id = NULL WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(accountId),
  ]);

  if (attachmentRows.length > 0) {
    try {
      await env.ATTACHMENTS.delete(attachmentRows.map((r) => r.r2_key));
    } catch {
      /* Ett föräldralöst R2-objekt är inte längre åtkomligt från appen. */
    }
  }
}

export async function createAccount(
  db: D1Database,
  fields: { email: string; passwordHash: string; passwordSalt: string; verificationCode: string },
) {
  const id = randomId();
  const now = Date.now();
  const expires = now + 30 * 60 * 1000;
  await db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, password_set_by_user, email_verified, verification_code, verification_expires_at, created_at)
       VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    )
    .bind(id, fields.email, fields.passwordHash, fields.passwordSalt, fields.verificationCode, expires, now)
    .run();
  return id;
}

export async function verifyAccountEmail(db: D1Database, accountId: string, code: string): Promise<boolean> {
  const account = await db
    .prepare("SELECT verification_code, verification_expires_at FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ verification_code: string; verification_expires_at: number }>();
  if (!account) return false;
  if (account.verification_code !== code) return false;
  if (Date.now() > account.verification_expires_at) return false;
  await db.prepare("UPDATE accounts SET email_verified = 1 WHERE id = ?").bind(accountId).run();
  return true;
}

export async function listAreas(db: D1Database) {
  const { results } = await db
    .prepare("SELECT area_name, area_type, COUNT(*) as count FROM politicians GROUP BY area_name, area_type ORDER BY area_type, area_name")
    .all();
  return results;
}

export async function listParties(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT area_type, area_name, party, COUNT(*) as count FROM politicians
       WHERE party IS NOT NULL GROUP BY area_type, area_name, party ORDER BY area_type, area_name, party`,
    )
    .all();
  return results;
}

export async function listRoles(db: D1Database) {
  const { results } = await db
    .prepare(`SELECT role, COUNT(*) as count FROM politicians WHERE role IS NOT NULL AND TRIM(role) != '' GROUP BY role`)
    .all<{ role: string; count: number }>();

  const merged = new Map<string, { role_key: string; role: string; count: number }>();
  for (const row of results) {
    const { key, label } = canonicalRole(row.role);
    const existing = merged.get(key);
    if (existing) existing.count += row.count;
    else merged.set(key, { role_key: key, role: label, count: row.count });
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}

async function rawRolesForCanonicalKeys(db: D1Database, canonicalKeys: string[]): Promise<string[]> {
  if (canonicalKeys.length === 0) return [];
  const wanted = new Set(canonicalKeys);
  const { results } = await db
    .prepare("SELECT DISTINCT role FROM politicians WHERE role IS NOT NULL AND TRIM(role) != ''")
    .all<{ role: string }>();
  return results.filter((r) => wanted.has(canonicalRole(r.role).key)).map((r) => r.role);
}

export interface PoliticianSearchHit {
  name: string;
  email: string;
  affiliations: { role: string | null; area_name: string; party: string | null }[];
}

const AFF_SEP = "\x1e";
const FIELD_SEP = "\x1f";

export async function searchPoliticiansInAreas(db: D1Database, areaNames: string[], query: string): Promise<PoliticianSearchHit[]> {
  let sql = `SELECT email, MAX(name) as name,
       GROUP_CONCAT(
         COALESCE(NULLIF(TRIM(role), ''), '') || CHAR(31) || area_name || CHAR(31) || COALESCE(party, ''),
         CHAR(30)
       ) as affiliations
     FROM politicians
     WHERE name LIKE ? AND email IS NOT NULL AND email != ''`;
  const params: unknown[] = [`%${query}%`];
  if (areaNames.length > 0) {
    sql += ` AND area_name IN (${areaNames.map(() => "?").join(",")})`;
    params.push(...areaNames);
  }
  sql += ` GROUP BY email ORDER BY name LIMIT 50`;
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<{ email: string; name: string; affiliations: string | null }>();

  return results.map((r) => {
    const seen = new Set<string>();
    const affiliations: PoliticianSearchHit["affiliations"] = [];
    for (const part of (r.affiliations ?? "").split(AFF_SEP)) {
      if (seen.has(part)) continue;
      seen.add(part);
      const [role, area_name, party] = part.split(FIELD_SEP);
      affiliations.push({ role: role || null, area_name: area_name ?? "", party: party || null });
    }
    return { name: r.name, email: r.email, affiliations };
  });
}

export async function getRecipientsForAreas(
  db: D1Database,
  areaNames: string[],
  excludeParties: string[] = [],
  excludeEmails: string[] = [],
  includeRoles: string[] = [],
  includeEmails: string[] = [],
) {
  const byEmail = new Map<string, { name: string; email: string; area_name: string }>();
  const hasPoolIntent = areaNames.length > 0 || includeRoles.length > 0;
  if (hasPoolIntent) {
    const rawRoles = includeRoles.length > 0 ? await rawRolesForCanonicalKeys(db, includeRoles) : [];
    const roleFilterExcludesAll = includeRoles.length > 0 && rawRoles.length === 0;
    if (!roleFilterExcludesAll) {
      let sql = `SELECT name, email, area_name FROM politicians
                 WHERE email IS NOT NULL AND TRIM(email) != ''
                   AND (verification_status IS NULL OR verification_status NOT IN ('dead', 'dead_via_send'))`;
      const params: unknown[] = [];
      if (areaNames.length > 0) {
        sql += ` AND area_name IN (SELECT value FROM json_each(?))`;
        params.push(JSON.stringify(areaNames));
      }
      if (rawRoles.length > 0) {
        sql += ` AND role IN (SELECT value FROM json_each(?))`;
        params.push(JSON.stringify(rawRoles));
      }
      if (excludeParties.length > 0) {
        sql += ` AND (party IS NULL OR party NOT IN (SELECT value FROM json_each(?)))`;
        params.push(JSON.stringify(excludeParties));
      }
      const { results } = await db
        .prepare(sql)
        .bind(...params)
        .all<{ name: string; email: string; area_name: string }>();
      for (const r of results) byEmail.set(r.email.trim().toLocaleLowerCase("sv-SE"), { ...r, email: r.email.trim() });
    }
  }

  if (includeEmails.length > 0) {
    const { results } = await db
      .prepare(`SELECT name, email, area_name FROM politicians
                WHERE email IN (SELECT value FROM json_each(?))
                  AND (verification_status IS NULL OR verification_status NOT IN ('dead', 'dead_via_send'))`)
      .bind(JSON.stringify(includeEmails))
      .all<{ name: string; email: string; area_name: string }>();
    for (const r of results) byEmail.set(r.email.trim().toLocaleLowerCase("sv-SE"), { ...r, email: r.email.trim() });
  }

  for (const e of excludeEmails) byEmail.delete(e.trim().toLocaleLowerCase("sv-SE"));
  return [...byEmail.values()];
}

export async function countSentToday(db: D1Database, accountId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await db
    .prepare("SELECT COUNT(*) as n FROM send_log WHERE account_id = ? AND sent_at >= ? AND status = 'ok'")
    .bind(accountId, startOfDay.getTime())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countSentTodayForCredential(db: D1Database, mailCredentialId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM send_log sl
       JOIN send_jobs sj ON sj.id = sl.send_job_id
       WHERE sj.mail_credential_id = ? AND sl.sent_at >= ? AND sl.status = 'ok'`,
    )
    .bind(mailCredentialId, startOfDay.getTime())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getMailCredential(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM mail_credentials WHERE id = ?").bind(id).first();
}
