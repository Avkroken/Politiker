import { randomId } from "../../shared/crypto";
import { sendSmtpMail, escapeHtml } from "../../shared/smtp";
import type { Env } from "./db";
import { decryptLetterData, encryptLetterData } from "./letter-privacy";

const APPROVAL_NOTIFY_EMAIL="politiker@denied.se", OUTLOOK_SMTP_HOST="smtp.office365.com", OUTLOOK_SMTP_PORT=587, OUTLOOK_SMTP_USER="RichMissile@outlook.com";
const QUARTERLY_MARKER="internal:quarterly";
export interface CivicLetterDraft { id:string; subject:string; htmlBody:string; topicSourceUrl:string|null; status:"pending"|"approved"|"rejected"|"sending"|"done"; approveToken:string; createdAt:number; approvedAt:number|null; }

type DraftRow={id:string;subject:string;html_body:string;topic_source_url:string|null;status:string;approve_token:string;created_at:number;approved_at:number|null};
async function toDraft(env:Env,row:DraftRow):Promise<CivicLetterDraft>{return{id:row.id,subject:row.subject,htmlBody:await decryptLetterData(env,row.html_body),topicSourceUrl:row.topic_source_url,status:row.status as CivicLetterDraft["status"],approveToken:row.approve_token,createdAt:row.created_at,approvedAt:row.approved_at};}

export async function createCivicLetterDraft(env:Env,fields:{subject:string;htmlBody:string;topicSourceUrl?:string}):Promise<CivicLetterDraft>{const id=randomId(),approveToken=randomId()+randomId(),now=Date.now();await env.DB.prepare(`INSERT INTO civic_letter_drafts (id,subject,html_body,topic_source_url,status,approve_token,created_at) VALUES (?,?,?,?,'pending',?,?)`).bind(id,fields.subject,await encryptLetterData(env,fields.htmlBody),fields.topicSourceUrl??null,approveToken,now).run();return{id,subject:fields.subject,htmlBody:fields.htmlBody,topicSourceUrl:fields.topicSourceUrl??null,status:"pending",approveToken,createdAt:now,approvedAt:null};}
export async function sendApprovalNotification(env:Env,draft:CivicLetterDraft):Promise<void>{if(!env.CIVIC_OUTLOOK_PASSWORD)throw new Error("CIVIC_OUTLOOK_PASSWORD är inte konfigurerad (wrangler secret)");const mail=approvalEmailBody(draft);await sendSmtpMail({host:OUTLOOK_SMTP_HOST,port:OUTLOOK_SMTP_PORT,user:OUTLOOK_SMTP_USER,password:env.CIVIC_OUTLOOK_PASSWORD,fromAddress:OUTLOOK_SMTP_USER},{to:mail.to,subject:mail.subject,html:mail.html});}
export function approvalEmailBody(draft:CivicLetterDraft):{to:string;subject:string;html:string}{const approveUrl=`https://politiker.denied.se/api/civic-letter/${draft.id}/approve?token=${draft.approveToken}`,rejectUrl=`https://politiker.denied.se/api/civic-letter/${draft.id}/reject?token=${draft.approveToken}`,source=draft.topicSourceUrl&&draft.topicSourceUrl!==QUARTERLY_MARKER?escapeHtml(draft.topicSourceUrl):null,safeSubject=escapeHtml(draft.subject),safeBody=escapeHtml(draft.htmlBody);return{to:APPROVAL_NOTIFY_EMAIL,subject:`Granska redaktionellt brev: ${draft.subject}`,html:`<p>Ett AI-författat brev väntar på manuell granskning. Inget skickas eller publiceras innan du godkänner det.</p>${source?`<p>Källa: ${source}</p>`:""}<hr><h3>${safeSubject}</h3><pre style="font-family:inherit;white-space:pre-wrap">${safeBody}</pre><hr><p><a href="${approveUrl}">Godkänn och skicka</a>&nbsp;<a href="${rejectUrl}">Avslå</a></p>`};}

export async function approveCivicLetterDraft(env:Env,draftId:string,token:string):Promise<void>{
  const row=await env.DB.prepare("SELECT id,subject,html_body,topic_source_url,status,approve_token,created_at,approved_at FROM civic_letter_drafts WHERE id=?").bind(draftId).first<DraftRow>();
  if(!row||row.approve_token!==token)throw new Error("Ogiltig eller okänd länk");
  if(row.status!=="pending")throw new Error(`Redan hanterad (status: ${row.status})`);
  const now=Date.now();
  await env.DB.prepare("UPDATE civic_letter_drafts SET status='approved',approved_at=? WHERE id=?").bind(now,draftId).run();
  const source=row.topic_source_url===QUARTERLY_MARKER?"quarterly":"campaign";
  const existing=await env.DB.prepare("SELECT id FROM public_letters WHERE source=? AND subject=? AND published_at>? LIMIT 1").bind(source,row.subject,now-90*24*60*60*1000).first();
  if(!existing){
    await env.DB.prepare("INSERT INTO public_letters (id,source,account_id,subject,body,area_name,published_at) VALUES (?,?,NULL,?,?,NULL,?)")
      .bind(randomId(),source,row.subject,await encryptLetterData(env,await decryptLetterData(env,row.html_body)),now).run();
  }
}
export async function rejectCivicLetterDraft(env:Env,draftId:string,token:string):Promise<void>{const draft=await env.DB.prepare("SELECT approve_token,status FROM civic_letter_drafts WHERE id=?").bind(draftId).first<{approve_token:string;status:string}>();if(!draft||draft.approve_token!==token)throw new Error("Ogiltig eller okänd länk");if(draft.status!=="pending")throw new Error(`Redan hanterad (status: ${draft.status})`);await env.DB.prepare("UPDATE civic_letter_drafts SET status='rejected' WHERE id=?").bind(draftId).run();}
const ALLOWED_STATUS_TRANSITIONS:Record<"sending"|"done",string>={sending:"approved",done:"sending"};
export async function setCivicLetterStatus(env:Env,draftId:string,status:"sending"|"done"):Promise<void>{const required=ALLOWED_STATUS_TRANSITIONS[status],result=await env.DB.prepare("UPDATE civic_letter_drafts SET status=? WHERE id=? AND status=?").bind(status,draftId,required).run();if(result.meta.changes===0)throw new Error(`Ogiltig statusövergång till "${status}" — draften finns inte eller har inte status "${required}"`);}
export async function getCivicLetterDraft(env:Env,draftId:string):Promise<CivicLetterDraft|null>{const row=await env.DB.prepare("SELECT id,subject,html_body,topic_source_url,status,approve_token,created_at,approved_at FROM civic_letter_drafts WHERE id=?").bind(draftId).first<DraftRow>();return row?toDraft(env,row):null;}
export type CivicLetterDraftPublic=Omit<CivicLetterDraft,"approveToken">;
export function redactApproveToken(draft:CivicLetterDraft):CivicLetterDraftPublic{const{approveToken:_approveToken,...rest}=draft;return rest;}
export async function getApprovedUnsentDraft(env:Env):Promise<CivicLetterDraft|null>{const row=await env.DB.prepare("SELECT id,subject,html_body,topic_source_url,status,approve_token,created_at,approved_at FROM civic_letter_drafts WHERE status='approved' ORDER BY approved_at ASC LIMIT 1").first<DraftRow>();return row?toDraft(env,row):null;}
