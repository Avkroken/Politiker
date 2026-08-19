// Daglig hälsokontroll för politiker-webapp — ersätter det gamla
// infra/healthcheck.py som kördes via crontab på mp100. Skälet till flytten:
// skriptet läste en Cloudflare-token ur ~/.claude/credentials.env som
// medvetet togs bort (målet är noll Cloudflare-tokens på disk), vilket gjorde
// att skriptet kastade KeyError och kontrollen dog helt tyst.
//
// Endast scheduled() — ingen HTTP-route, ingen yta att anropa utifrån.
//
// POLITIKER_WEBAPP_HEALTHCHECK_TOKEN är VALFRI. Den gamla varianten kraschade hårt (KeyError) om
// token saknades — det felet ska aldrig upprepas. Saknas den hoppar Workern
// bara över de två kontroller som kräver Cloudflare REST (worker-listan och
// domän-/Access-diagnosen) och lägger till en notis om att diagnostiken är
// avstängd. D1-kontrollerna (radantal, fastnade jobb) går via binding och
// behöver ingen token alls.

interface Env {
  DB: D1Database;
  ACCOUNT_ID: string;
  DOMAIN: string;
  APP_WORKER: string;
  SENDER_WORKER: string;
  EMAIL_TO: string;
  EMAIL_FROM: string;
  POLITIKER_WEBAPP_HEALTHCHECK_TOKEN?: string;
  RESEND_API_KEY?: string;
}

const CF_API = "https://api.cloudflare.com/client/v4";
const HTTP_TIMEOUT_MS = 10_000;
const STUCK_JOB_CUTOFF_MS = 24 * 60 * 60 * 1000;

// Kastar vid allt som inte är ett lyckat svar. Utan det returnerade en 403
// (token återkallad eller utan behörighet) `{success:false, result:null}` med
// HTTP-felet osynligt, och anroparnas `resp.result ?? []` blev en tom lista —
// som lästes som "resursen finns inte". Det gav hälsomejlet "Worker
// 'politiker-webapp-app' saknas helt i kontot!" för en Worker som levde och
// betjänade trafik. Ett larm som ljuger om den allvarligaste tänkbara
// händelsen är värre än inget larm.
async function cfGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${CF_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; errors?: Array<{ message?: string }> }
    | null;
  if (!res.ok || body?.success === false) {
    const detail = body?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare API ${res.status} på ${path}: ${detail}`);
  }
  return body;
}

// 1. Publikt HTTP-svar: samma två endpoints som operatören själv testar
// manuellt när något känns fel.
async function checkPublicHttp(env: Env, problems: string[]): Promise<void> {
  try {
    const root = await fetch(`https://${env.DOMAIN}/`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (root.status !== 200) {
      problems.push(`https://${env.DOMAIN}/ svarade ${root.status} (förväntat 200)`);
    }
  } catch (e) {
    problems.push(`Kunde inte nå https://${env.DOMAIN}/: ${String(e)}`);
  }
  try {
    const me = await fetch(`https://${env.DOMAIN}/api/me`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    await me.json(); // kastar om svaret inte är giltig JSON
    if (me.status !== 200) {
      problems.push(`/api/me svarade ${me.status} (förväntat 200)`);
    }
  } catch (e) {
    problems.push(`Kunde inte nå /api/me eller svaret var inte giltig JSON: ${String(e)}`);
  }
}

// 2. Workers existerar i kontot — kräver POLITIKER_WEBAPP_HEALTHCHECK_TOKEN, hoppas över utan.
async function checkWorkersExist(env: Env, token: string, problems: string[]): Promise<void> {
  try {
    const resp = await cfGet(token, `/accounts/${env.ACCOUNT_ID}/workers/scripts`);
    const names = new Set<string>((resp.result ?? []).map((s: { id: string }) => s.id));
    for (const name of [env.APP_WORKER, env.SENDER_WORKER]) {
      if (!names.has(name)) {
        problems.push(`Worker '${name}' saknas helt i kontot!`);
      }
    }
  } catch (e) {
    problems.push(`Kunde inte lista Workers i kontot: ${String(e)}`);
  }
}

// 3. D1 nåbar — rapporteras som en notis, inte ett problem, oavsett antal.
async function checkD1Reachable(env: Env, problems: string[], notes: string[]): Promise<void> {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) as n FROM politicians").first<{ n: number }>();
    notes.push(`D1: ${row?.n ?? 0} politiker i databasen`);
  } catch (e) {
    problems.push(`Kunde inte nå D1: ${String(e)}`);
  }
}

// 3b. Regiontäckning — att TOTALEN ser frisk ut säger ingenting om
// fördelningen. Uppmätt 2026-08-18: 17 196 politiker i databasen, alltså
// en fullt trovärdig siffra, samtidigt som Region Skåne och Region
// Örebro län hade NOLL ledamöter och Region Sörmland två. Kontrollen
// ovan hade rapporterat det som en notis och ingen hade märkt något.
//
// Alla 21 regioner ska finnas. En som saknas helt är trasig; en med
// enstaka poster är en skrapning som gått halvvägs och tystnat.
// Trösklarna är rök-, inte kravnivåer: minsta regionfullmäktige har
// ett par tiotal ledamöter, men skrapan får bara med dem som har
// publicerad e-post, så golvet sätts lågt med flit — det ska fånga
// "uppenbart trasig", inte "ofullständig".
const EXPECTED_REGIONS = 21;
const THIN_REGION_THRESHOLD = 10;

async function checkRegionCoverage(env: Env, problems: string[], notes: string[]): Promise<void> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT area_name, COUNT(*) as n FROM politicians WHERE area_type = 'region' GROUP BY area_name",
    ).all<{ area_name: string; n: number }>();
    const rows = results ?? [];

    if (rows.length < EXPECTED_REGIONS) {
      problems.push(
        `Bara ${rows.length} av ${EXPECTED_REGIONS} regioner har ledamöter i databasen — ` +
          "de som saknas går inte att kontakta via sajten",
      );
    }

    const thin = rows
      .filter((r) => r.n < THIN_REGION_THRESHOLD)
      .map((r) => `${r.area_name} (${r.n})`);
    if (thin.length > 0) {
      problems.push(`Misstänkt tunn regiontäckning, skrapningen kan ha avbrutits: ${thin.join(", ")}`);
    }

    notes.push(`D1: ${rows.length} regioner representerade`);
  } catch (e) {
    problems.push(`Kunde inte kontrollera regiontäckning: ${String(e)}`);
  }
}

// 4. Fastnade sändningsjobb — sender-workern kan ha fastnat om något legat
// kvar i pending/sending i över 24h.
async function checkStuckJobs(env: Env, problems: string[]): Promise<void> {
  try {
    const cutoffMs = Date.now() - STUCK_JOB_CUTOFF_MS;
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM send_jobs WHERE status IN ('pending','sending') AND created_at < ?",
    )
      .bind(cutoffMs)
      .first<{ n: number }>();
    const stuckN = row?.n ?? 0;
    if (stuckN > 0) {
      problems.push(`${stuckN} sändningsjobb har varit pending/sending i över 24h — sender-workern kan ha fastnat`);
    }
  } catch (e) {
    problems.push(`Kunde inte kontrollera kö-status: ${String(e)}`);
  }
}

// 5. Diagnos — körs bara om något redan är trasigt, och bara med POLITIKER_WEBAPP_HEALTHCHECK_TOKEN.
// Täcker de två fel vi faktiskt stötte på under utvecklingen (se README):
// fel custom-domain-koppling och saknad Access-bypass-policy.
async function diagnoseIfBroken(env: Env, token: string, problems: string[]): Promise<void> {
  try {
    const domainResp = await cfGet(token, `/accounts/${env.ACCOUNT_ID}/workers/domains?domain=${env.DOMAIN}`);
    const domains = domainResp.result ?? [];
    if (domains.length > 0 && domains[0].service !== env.APP_WORKER) {
      problems.push(
        `DIAGNOS: Custom domain ${env.DOMAIN} pekar mot '${domains[0].service}' istället för ` +
          `'${env.APP_WORKER}' — samma fel som under utvecklingen, fixa med PUT ` +
          `/workers/domains/records/${domains[0].id}`,
      );
    }
  } catch {
    // Diagnos är bäst-ansträngning — ett fel här ska inte dölja huvudproblemet.
  }

  try {
    const appsResp = await cfGet(token, `/accounts/${env.ACCOUNT_ID}/access/apps`);
    const apps: Array<{ domain?: string; policies?: Array<{ decision?: string }> }> = appsResp.result ?? [];
    const app = apps.find((a) => a.domain === env.DOMAIN);
    if (!app) {
      problems.push(`DIAGNOS: Ingen Access-app hittades för ${env.DOMAIN} — publik bypass-policy kan ha försvunnit`);
    } else if (!(app.policies ?? []).some((p) => p.decision === "bypass")) {
      problems.push(`DIAGNOS: Access-appen för ${env.DOMAIN} har ingen bypass-policy längre — sidan kan vara blockerad för besökare`);
    }
  } catch (e) {
    // Inte tyst som ovan: den här grenen drar en slutsats ur en tom lista, så
    // ett läsfel skulle annars läsas som "Access-appen är borta".
    problems.push(`DIAGNOS: kunde inte läsa Access-apparna, ingen slutsats om ${env.DOMAIN}: ${String(e)}`);
  }
}

async function sendStatusMail(env: Env, subject: string, body: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.error("kan inte maila: RESEND_API_KEY saknas");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [env.EMAIL_TO],
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    // Loggas men kastas inte vidare: ett misslyckat mejl ska inte se ut som
    // att hälsokontrollen aldrig kördes (syns ändå i wrangler tail-loggen).
    console.error(`Resend svarade ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const problems: string[] = [];
    const notes: string[] = [];

    await checkPublicHttp(env, problems);
    await checkD1Reachable(env, problems, notes);
    await checkRegionCoverage(env, problems, notes);
    await checkStuckJobs(env, problems);

    const token = env.POLITIKER_WEBAPP_HEALTHCHECK_TOKEN;
    if (token) {
      await checkWorkersExist(env, token, problems);
      if (problems.length > 0) {
        await diagnoseIfBroken(env, token, problems);
      }
    } else {
      notes.push("Diagnostik (Cloudflare API) avstängd: POLITIKER_WEBAPP_HEALTHCHECK_TOKEN saknas — worker-listan och domän-/Access-diagnosen hoppades över");
    }

    const status = problems.length === 0 ? "OK" : `PROBLEM (${problems.length})`;
    const bodyLines = [`Status: ${status}`, ""];
    if (notes.length > 0) bodyLines.push(...notes, "");
    if (problems.length > 0) {
      bodyLines.push("Problem:");
      bodyLines.push(...problems.map((p) => `- ${p}`));
    }
    const body = bodyLines.join("\n");
    const subject = `Politiker-webapp hälsokontroll: ${status}`;

    console.log(body);
    ctx.waitUntil(sendStatusMail(env, subject, body));
  },
} satisfies ExportedHandler<Env>;
