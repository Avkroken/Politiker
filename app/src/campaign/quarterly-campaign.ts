import type { Env } from "./index";
import { callAnthropic, ANTHROPIC_SONNET, AnthropicBudgetExceededError } from "../../../shared/anthropic";
import { notifyBudgetExhausted } from "./notify";
import { sendApprovalNotification } from "../civic-outreach";
import { decryptLetterData, encryptLetterData } from "../letter-privacy";

export const QUARTERLY_MARKER = "internal:quarterly";
const RESEARCH_ITEMS = 40;
const EDITORIAL_NAME = "Politikerredaktionen";
const EDITORIAL_EMAIL = "politiker@denied.se";
interface CorpusItem { title: string; summary: string | null; url: string; source: string }
function currentQuarterStartMs(now: Date): number { return Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1); }

export async function runQuarterlyCampaign(env: Env): Promise<void> {
  const quarterStart = currentQuarterStartMs(new Date());
  const existing = await env.DB.prepare("SELECT id FROM civic_letter_drafts WHERE topic_source_url=? AND created_at>=? LIMIT 1").bind(QUARTERLY_MARKER, quarterStart).first();
  if (existing) { console.log("quarterly: kvartalets utkast finns redan"); return; }
  const { results: items } = await env.DB.prepare("SELECT title,summary,url,source FROM monitored_items WHERE letter_queued=1 AND created_at>=? ORDER BY CASE WHEN source='riksdagen' THEN 0 WHEN source LIKE 'svt_%' THEN 1 ELSE 2 END, created_at DESC LIMIT ?").bind(quarterStart - 92 * 24 * 3600 * 1000, RESEARCH_ITEMS).all<CorpusItem>();
  if (!items.length) { console.log("quarterly: inget tillräckligt underlag — skapar inget brev"); return; }
  const corpus = items.map(i => `- [${i.source}] ${i.title}: ${(i.summary ?? "").slice(0, 260)}\n  Källa: ${i.url}`).join("\n");
  let raw: string;
  try {
    raw = await callAnthropic(env.ANTHROPIC_API_KEY, { model: ANTHROPIC_SONNET, maxTokens: 2200, prompt: `Du skriver för ${EDITORIAL_NAME}, en oberoende redaktionell funktion på Politikerkontakt. Brevet går till förtroendevalda på flera nivåer i Sverige.

Underlag från detta kvartal:
${corpus}

Skriv ett professionellt kvartalsbrev på 500–700 ord.

Redaktionella krav:
1. Inled "Till dig som förtroendevald,".
2. Välj högst tre samhällsfrågor där underlaget visar konkret betydelse för invånare, offentliga resurser, trygghet, social sammanhållning, miljö/resurshushållning eller långsiktig samhällsfunktion.
3. Prioritera Riksdagens och SVT:s material framför kommersiella nyhetskällor. Kommersiella nyhetskällor får vara signaler men ska inte ensamma bära ett långtgående faktapåstående.
4. HITTA ALDRIG PÅ statistik, citat, forskningsresultat, myndighetsuppgifter eller kausala samband. Använd bara det som faktiskt framgår av underlaget. Om belägg saknas, ställ en fråga i stället.
5. Kritik ska vara konkret och kopplad till ett beslut, en konsekvens eller ett tydligt ansvar. Erkänn även positiva resultat när underlaget faktiskt stöder dem.
6. Gör inga generaliseringar om människor utifrån etnicitet, religion, nationalitet eller annan gruppidentitet. Om gruppskillnader är sakligt relevanta ska de beskrivas neutralt och endast när underlaget ger verifierbart stöd.
7. Kräv 2–4 konkreta svar: vad ska göras, vem ansvarar, hur mäts effekten och när ska resultat följas upp?
8. Lägg sist en rubrik "Källor" och lista de 2–5 URL:er från underlaget som brevet faktiskt bygger på. Lägg inte till andra källor.
9. Signera exakt:
Med vänlig hälsning
${EDITORIAL_NAME}
${EDITORIAL_EMAIL}

Ton: saklig, tydlig, kritisk när fakta motiverar det. Inga personangrepp, slagord eller fabricerade säkerheter.
Svara med EXAKT detta format:
ÄMNE: <ämnesrad, max 80 tecken>
<tom rad>
<brevtexten>` }, env.DB);
  } catch (e) {
    if (e instanceof AnthropicBudgetExceededError) { await notifyBudgetExhausted(env, "quarterly-campaign", "Kvartalsbrevet hoppades över denna körning."); return; }
    throw e;
  }
  const match = raw.match(/^ÄMNE:\s*(.+)\n+([\s\S]+)$/);
  if (!match) throw new Error("quarterly: kunde inte tolka ÄMNE/brödtext ur modellsvaret");
  const subject = match[1].trim().slice(0, 120), body = match[2].trim();
  const draftId = crypto.randomUUID(), approveToken = crypto.randomUUID() + crypto.randomUUID(), now = Date.now();
  await env.DB.prepare("INSERT INTO civic_letter_drafts (id,subject,html_body,topic_source_url,status,approve_token,created_at) VALUES (?,?,?,?,'pending',?,?)").bind(draftId, subject, await encryptLetterData(env, body), QUARTERLY_MARKER, approveToken, now).run();
  const res = await env.DB.prepare(`INSERT INTO campaign_recipients (id,draft_id,politician_id,politician_email,politician_name,area_name) SELECT lower(hex(randomblob(16))), ?, id, email, name, area_name FROM politicians WHERE verification_status IS NULL OR verification_status NOT IN ('dead','dead_via_send') GROUP BY email`).bind(draftId).run();
  try { await sendApprovalNotification(env, { id:draftId, subject, htmlBody:body, topicSourceUrl:QUARTERLY_MARKER, status:"pending", approveToken, createdAt:now, approvedAt:null }); }
  catch (e) { console.error("quarterly: kunde inte skicka granskningsmail:", e); }
  console.log(`quarterly: brev "${subject}" skapat för granskning, ${res.meta.changes} mottagare köade`);
}

const DRAIN_PER_RUN = 300;
const MONTHLY_SEND_CAP = 25_000;
export async function runQuarterlyDrain(env: Env): Promise<void> {
  if (!env.EMAIL) return;
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const sentThisMonth = await env.DB.prepare(`SELECT COUNT(*) AS n FROM campaign_recipients cr JOIN civic_letter_drafts cld ON cld.id=cr.draft_id WHERE cr.status='sent' AND cr.sent_at>=? AND cld.topic_source_url=?`).bind(monthStart.getTime(),QUARTERLY_MARKER).first<{n:number}>();
  const remainingMonthly = Math.max(0, MONTHLY_SEND_CAP - (sentThisMonth?.n ?? 0));
  if (!remainingMonthly) return;
  const { results } = await env.DB.prepare(`SELECT cr.id,cr.draft_id,cr.politician_email,cld.subject,cld.html_body FROM campaign_recipients cr JOIN civic_letter_drafts cld ON cld.id=cr.draft_id WHERE cr.status='pending' AND cld.status='approved' AND cld.topic_source_url=? ORDER BY cr.rowid ASC LIMIT ?`).bind(QUARTERLY_MARKER,Math.min(DRAIN_PER_RUN,remainingMonthly)).all<{id:string;draft_id:string;politician_email:string;subject:string;html_body:string}>();
  let sent=0,failed=0;
  for(const rec of results){const now=Date.now();try{const body=await decryptLetterData(env,rec.html_body);if(!body)throw new Error("Brevtexten har raderats");await env.EMAIL.send({to:rec.politician_email,from:{email:EDITORIAL_EMAIL,name:EDITORIAL_NAME},replyTo:EDITORIAL_EMAIL,subject:rec.subject,html:`<pre style="font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap;line-height:1.55">${body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`,text:body});await env.DB.prepare("UPDATE campaign_recipients SET status='sent',sent_at=? WHERE id=?").bind(now,rec.id).run();sent++;}catch(e){const msg=String(e).slice(0,200);if(/RATE_LIMIT|DAILY_LIMIT|INTERNAL_SERVER/.test(msg)){console.warn(`quarterly-drain: pausar (${msg.slice(0,120)})`);break;}await env.DB.prepare("UPDATE campaign_recipients SET status='failed',error=? WHERE id=?").bind(msg,rec.id).run();failed++;}}
  await env.DB.prepare(`UPDATE civic_letter_drafts SET status='done' WHERE topic_source_url=? AND status='approved' AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.draft_id=civic_letter_drafts.id AND cr.status='pending')`).bind(QUARTERLY_MARKER).run();
  console.log(`quarterly-drain: ${sent} skickade, ${failed} misslyckade`);
}
