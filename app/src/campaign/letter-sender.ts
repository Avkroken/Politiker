import type { Env } from "./index";
import { decryptLetterData } from "../letter-privacy";

const MAX_PER_RUN = 20;
const EDITORIAL_NAME = "Politikerredaktionen";
const EDITORIAL_EMAIL = "politiker@denied.se";

interface PendingRecipient {
  id: string; draft_id: string; politician_email: string; politician_name: string;
  subject: string; html_body: string;
}

export async function runLetterSender(env: Env): Promise<void> {
  if (!env.EMAIL) { console.warn("letter-sender: EMAIL-binding saknas"); return; }
  const { results } = await env.DB.prepare(`
    SELECT cr.id,cr.draft_id,cr.politician_email,cr.politician_name,cld.subject,cld.html_body
    FROM campaign_recipients cr JOIN civic_letter_drafts cld ON cld.id=cr.draft_id
    WHERE cr.status='pending' AND cld.status='approved'
      AND (cld.topic_source_url IS NULL OR cld.topic_source_url!='internal:quarterly')
    ORDER BY cr.rowid ASC LIMIT ?
  `).bind(MAX_PER_RUN).all<PendingRecipient>();
  if (!results.length) { console.log("letter-sender: inga väntande brev"); return; }

  let sent=0,failed=0;
  for(const rec of results){
    const now=Date.now();
    try{
      const body=await decryptLetterData(env,rec.html_body);
      if(!body)throw new Error("Brevtexten har raderats");
      await env.EMAIL.send({
        to:rec.politician_email,
        from:{email:EDITORIAL_EMAIL,name:EDITORIAL_NAME},
        replyTo:EDITORIAL_EMAIL,
        subject:rec.subject,
        html:`<pre style="font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap;line-height:1.55">${body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`,
        text:body,
      });
      await env.DB.batch([
        env.DB.prepare("UPDATE campaign_recipients SET status='sent',sent_at=? WHERE id=?").bind(now,rec.id),
        env.DB.prepare("UPDATE civic_letter_drafts SET status='done' WHERE id=? AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE draft_id=? AND status='pending')").bind(rec.draft_id,rec.draft_id),
      ]);
      sent++;
    }catch(e){
      const err=String(e).slice(0,200);
      await env.DB.prepare("UPDATE campaign_recipients SET status='failed',error=? WHERE id=?").bind(err,rec.id).run();
      failed++;
    }
  }
  console.log(`letter-sender: ${sent} skickade, ${failed} misslyckade`);
}
