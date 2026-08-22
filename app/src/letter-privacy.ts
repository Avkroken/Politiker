import { decryptSecret, encryptSecret } from "../../shared/crypto";
import type { Env } from "./db";

const PREFIX = "enc:v1:";
const REDACTED = "redacted:v1";
const USER_CONTENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CIVIC_DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PUBLIC_LETTER_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const BACKFILL_BATCH = 50;
type PrivacyEnv = Env & { LETTER_DATA_KEY?: string };

function keyFor(env: PrivacyEnv): string { return env.LETTER_DATA_KEY || env.MAIL_CRED_KEY; }
export function isEncryptedLetterData(value: string): boolean { return value.startsWith(PREFIX); }
export async function encryptLetterData(env: PrivacyEnv, plaintext: string): Promise<string> { if (isEncryptedLetterData(plaintext) || plaintext === REDACTED) return plaintext; return PREFIX + await encryptSecret(plaintext, keyFor(env)); }
export async function decryptLetterData(env: PrivacyEnv, stored: string): Promise<string> { if (stored === REDACTED) return ""; if (!isEncryptedLetterData(stored)) return stored; return decryptSecret(stored.slice(PREFIX.length), keyFor(env)); }

async function backfillTable(env: PrivacyEnv, table: "letters"|"civic_letter_drafts"|"public_letters", column: "html_body"|"body"): Promise<void> {
  const {results}=await env.DB.prepare(`SELECT id,${column} AS content FROM ${table} WHERE ${column} NOT LIKE 'enc:v1:%' AND ${column} != ? LIMIT ?`).bind(REDACTED,BACKFILL_BATCH).all<{id:string;content:string}>();
  for(const row of results) await env.DB.prepare(`UPDATE ${table} SET ${column}=? WHERE id=? AND ${column} NOT LIKE 'enc:v1:%' AND ${column} != ?`).bind(await encryptLetterData(env,row.content),row.id,REDACTED).run();
}

async function redactFinishedUserLetters(env: PrivacyEnv, now:number):Promise<void>{
  const cutoff=now-USER_CONTENT_RETENTION_MS;
  const {results}=await env.DB.prepare(`SELECT DISTINCT l.id FROM letters l JOIN send_jobs sj ON sj.letter_id=l.id WHERE sj.status IN ('done','aborted') AND sj.finished_at IS NOT NULL AND sj.finished_at < ? AND l.html_body != ? LIMIT 100`).bind(cutoff,REDACTED).all<{id:string}>();
  for(const row of results){const {results:attachments}=await env.DB.prepare("SELECT r2_key FROM letter_attachments WHERE letter_id=?").bind(row.id).all<{r2_key:string}>();if(attachments.length){try{await env.ATTACHMENTS.delete(attachments.map(a=>a.r2_key));}catch(error){console.warn("letter-retention: R2 cleanup failed",{letterId:row.id,error:String(error)});continue;}}await env.DB.batch([env.DB.prepare("DELETE FROM letter_attachments WHERE letter_id=?").bind(row.id),env.DB.prepare("UPDATE letters SET html_body=? WHERE id=?").bind(REDACTED,row.id)]);}
}
async function redactOldCivicDrafts(env:PrivacyEnv,now:number):Promise<void>{await env.DB.prepare(`UPDATE civic_letter_drafts SET html_body=? WHERE status IN ('done','rejected') AND created_at < ? AND html_body != ?`).bind(REDACTED,now-CIVIC_DRAFT_RETENTION_MS,REDACTED).run();}
async function deleteOldPublicLetters(env:PrivacyEnv,now:number):Promise<void>{await env.DB.prepare("DELETE FROM public_letters WHERE published_at < ?").bind(now-PUBLIC_LETTER_RETENTION_MS).run();}
export async function protectStoredLetterData(env:PrivacyEnv):Promise<void>{await backfillTable(env,"letters","html_body");await backfillTable(env,"civic_letter_drafts","html_body");await backfillTable(env,"public_letters","body");}
export async function enforceLetterRetention(env:PrivacyEnv):Promise<void>{const now=Date.now();await redactFinishedUserLetters(env,now);await redactOldCivicDrafts(env,now);await deleteOldPublicLetters(env,now);}
