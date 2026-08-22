import type { Env } from "./index";
import { callAnthropic, ANTHROPIC_HAIKU, ANTHROPIC_SONNET, AnthropicBudgetExceededError, LETTER_GEN_CALL_BUDGET } from "../../../shared/anthropic";
import { notifyBudgetExhausted } from "./notify";
import { sendApprovalNotification } from "../civic-outreach";
import { encryptLetterData } from "../letter-privacy";

const MAX_ITEMS = 5;
const MAX_RECIPIENTS_PER_ITEM = 3;
const EDITORIAL_NAME = "Politikerredaktionen";
const EDITORIAL_EMAIL = "politiker@denied.se";

interface MonitoredItem { id:string; source:string; item_type:string; title:string; url:string; area_name:string|null; area_type:string; summary:string|null; }
interface Politician { id:string; name:string; email:string; area_name:string; party:string|null; role:string|null; }

async function isRelevant(item:MonitoredItem,apiKey:string,db:D1Database):Promise<boolean>{const answer=await callAnthropic(apiKey,{model:ANTHROPIC_HAIKU,maxTokens:5,prompt:`Avgör om följande nyhet eller riksdagsärende har tydlig betydelse för allmänintresset och svenska invånares vardag, offentliga resurser eller långsiktiga samhällsfunktioner.

Relevanta områden kan vara exempelvis välfärd, vård, skola, bostäder, arbetsmarknad, offentlig ekonomi, trygghet och rättsväsende, integration och social sammanhållning, infrastruktur, miljö/resurshushållning, demokrati, myndighetsutövning eller utrikespolitiska beslut med tydliga konsekvenser för Sverige.

Bedöm sakfrågan, inte parti eller ideologisk etikett. Hoppa över rena teknikaliteter eller ärenden utan konkret samhällseffekt.
Svara ENBART "ja" eller "nej".

Titel: ${item.title}
Sammanfattning: ${(item.summary??"").slice(0,500)}`,budget:LETTER_GEN_CALL_BUDGET},db);return answer.toLowerCase().startsWith("ja");}

async function generateLetter(item:MonitoredItem,pol:Politician,apiKey:string,db:D1Database):Promise<string>{const polDesc=[pol.name,pol.role,pol.party?`(${pol.party})`:null,pol.area_name].filter(Boolean).join(", "),typeLabel:Record<string,string>={motion:"motion",proposition:"proposition",betankande:"betänkande",news:"nyhet"};return callAnthropic(apiKey,{model:ANTHROPIC_SONNET,maxTokens:950,prompt:`Du skriver för ${EDITORIAL_NAME}, en oberoende redaktionell funktion på Politikerkontakt.

Mottagare: ${polDesc}
Ärende (${typeLabel[item.item_type]??"ärende"}): ${item.title}
Källsammanfattning: ${(item.summary??"").slice(0,900)}
Primär källa: ${item.url}

Skriv ett professionellt svenskt medborgarbrev på 260–360 ord.

Kvalitetskrav:
1. Hälsa mottagaren vid namn och förklara direkt varför frågan ligger inom mottagarens politiska ansvar.
2. Utgå endast från uppgifter som faktiskt framgår av den angivna källan/sammanfattningen eller är okontroversiella bakgrundsfakta. HITTA ALDRIG PÅ statistik, citat, forskningsresultat eller myndighetsuppgifter.
3. Om underlaget inte räcker för ett säkert faktapåstående: skriv det som en fråga eller begär förtydligande i stället för att fylla luckan själv.
4. Kritik ska vara konkret: identifiera beslut, konsekvens, ansvar och vad som bör följas upp. Beröm får förekomma när underlaget tydligt visar en välmotiverad eller effektiv åtgärd.
5. Fokusera på verifierbara effekter för invånare, samhällsekonomi, jämlik tillgång till service, trygghet, social sammanhållning, resursanvändning och miljö när det är relevant.
6. Gör inga generaliseringar om människor utifrån etnicitet, religion, nationalitet eller annan gruppidentitet. Om sådana faktorer är sakligt relevanta måste resonemanget vara knutet till verifierbara data i källan och uttryckas neutralt.
7. Ställ 1–3 konkreta frågor och begär svar på vad mottagaren tänker göra, hur effekten ska mätas och inom vilken tidsram.
8. Avsluta med en tydlig källrad: "Källa: ${item.url}".
9. Signera exakt:
Med vänlig hälsning
${EDITORIAL_NAME}
${EDITORIAL_EMAIL}

Ton: saklig, tydlig och kritisk när underlaget motiverar kritik. Ingen förolämpning, inget partipolitiskt slagord, ingen fabricerad säkerhet.
Skriv ENBART brevtexten.`,budget:LETTER_GEN_CALL_BUDGET},db);}

function randomId():string{return crypto.randomUUID();}
function makeSubject(item:MonitoredItem):string{const prefix:Record<string,string>={motion:"Motion",proposition:"Proposition",betankande:"Betänkande",news:"Nyhet"};return `${prefix[item.item_type]??"Ärende"}: ${item.title.slice(0,80)}`;}

async function relevantRecipients(env:Env,item:MonitoredItem):Promise<Politician[]>{
  if(item.area_type==="region"){
    const kw=(item.area_name??"").replace(/läns? landsting|landsting|Region /gi,"").trim();
    const{results}=await env.DB.prepare(`SELECT id,name,email,area_name,party,role FROM politicians WHERE area_type='region' AND (area_name LIKE ? OR area_name LIKE ?) AND (verification_status IS NULL OR verification_status!='dead_via_send') ORDER BY CASE WHEN role LIKE '%ordför%' THEN 0 ELSE 1 END,RANDOM() LIMIT ?`).bind(`%${kw}%`,`%${item.area_name??""}%`,MAX_RECIPIENTS_PER_ITEM).all<Politician>();return results;
  }
  const{results}=await env.DB.prepare(`SELECT id,name,email,area_name,party,role FROM politicians WHERE area_type IN ('riksdag','regering') AND (verification_status IS NULL OR verification_status!='dead_via_send') ORDER BY CASE WHEN area_type='regering' THEN 0 ELSE 1 END,CASE WHEN role LIKE '%minister%' OR role LIKE '%ordför%' THEN 0 ELSE 1 END,RANDOM() LIMIT ?`).bind(MAX_RECIPIENTS_PER_ITEM).all<Politician>();return results;
}

export async function runLetterGenerator(env:Env):Promise<void>{
  // Dagliga redaktionella brev kräver en källa med rimlig förstahands-/public-service-nivå.
  // Kommersiella feeds ligger kvar som bevakningssignaler men får inte ensamma trigga utskick.
  const{results:items}=await env.DB.prepare("SELECT id,source,item_type,title,url,area_name,area_type,summary FROM monitored_items WHERE letter_queued=0 AND (source='riksdagen' OR source LIKE 'svt_%') ORDER BY created_at ASC LIMIT ?").bind(MAX_ITEMS).all<MonitoredItem>();
  if(!items.length){console.log("letter-gen: inga nya kvalificerade ärenden");return;}
  let totalDrafts=0;
  for(const item of items){
    let relevant:boolean;
    try{relevant=await isRelevant(item,env.ANTHROPIC_API_KEY,env.DB);}catch(e){if(e instanceof AnthropicBudgetExceededError){await notifyBudgetExhausted(env,"letter-generator",`${totalDrafts} brevutkast skapade innan budgeten tog slut. Resterande ärenden ligger kvar i kön.`);return;}throw e;}
    if(!relevant){await env.DB.prepare("UPDATE monitored_items SET letter_queued=2 WHERE id=?").bind(item.id).run();continue;}
    const politicians=await relevantRecipients(env,item);if(!politicians.length){await env.DB.prepare("UPDATE monitored_items SET letter_queued=2 WHERE id=?").bind(item.id).run();continue;}
    let itemDrafts=0;const subject=makeSubject(item);
    for(const pol of politicians){try{const body=await generateLetter(item,pol,env.ANTHROPIC_API_KEY,env.DB),encryptedBody=await encryptLetterData(env,body),draftId=randomId(),approveToken=randomId()+randomId(),now=Date.now();await env.DB.batch([env.DB.prepare("INSERT INTO civic_letter_drafts (id,subject,html_body,topic_source_url,status,approve_token,created_at) VALUES (?,?,?,?,'pending',?,?)").bind(draftId,subject,encryptedBody,item.url,approveToken,now),env.DB.prepare("INSERT INTO campaign_recipients (id,draft_id,politician_id,politician_email,politician_name,area_name) VALUES (?,?,?,?,?,?)").bind(randomId(),draftId,pol.id,pol.email,pol.name,pol.area_name)]);await sendApprovalNotification(env,{id:draftId,subject,htmlBody:body,topicSourceUrl:item.url,status:"pending",approveToken,createdAt:now,approvedAt:null});totalDrafts++;itemDrafts++;}catch(e){if(e instanceof AnthropicBudgetExceededError){if(itemDrafts>0)await env.DB.prepare("UPDATE monitored_items SET letter_queued=1 WHERE id=?").bind(item.id).run();await notifyBudgetExhausted(env,"letter-generator",`${totalDrafts} brevutkast skapade innan budgeten tog slut. Resterande ärenden ligger kvar i kön.`);return;}console.error(`letter-gen: fel för ${pol.name}:`,e);}}
    if(itemDrafts>0)await env.DB.prepare("UPDATE monitored_items SET letter_queued=1 WHERE id=?").bind(item.id).run();
  }
  console.log(`letter-gen: ${totalDrafts} brevutkast skapade för manuell granskning`);
}
