import { runMonitor } from "./monitor";
import { runLetterGenerator } from "./letter-generator";
import { runLetterSender } from "./letter-sender";
import { runNewsletterSender } from "./newsletter-sender";
import { runQuarterlyCampaign, runQuarterlyDrain } from "./quarterly-campaign";
import { runBounceSweep } from "./bounce-sweep";

// Kampanjmodulerna importerar Env från "./index" sedan de låg i en egen
// Worker. Efter sammanslagningen är den appens Env — men med ANTHROPIC_API_KEY
// smalnad till string. Appens fetch-väg klarar sig utan nyckeln (draft-letter
// felar begripligt när den saknas), medan kampanjen inte har någon meningsfull
// delmängd att köra utan den: brevgenerering, relevansfiltrering,
// bounce-sweep och kvartalsbrevet anropar alla Claude.
//
// Grinden står i handleScheduled nedan och körs en gång per cron, i stället
// för fyra optional-checkar utspridda i modulerna.
import type { Env as AppEnv } from "../db";
export type Env = AppEnv & { ANTHROPIC_API_KEY: string };

// Cron-tider (UTC):
//   05:00 → monitor        (07:00 CET)
//   06:00 → letter-gen     (08:00 CET)
//   07:00 → letter-sender  (09:00 CET)
//   08:00 → bounce-sweep   (10:00 CET)
//   06:30 den 1:a i jan/apr/jul/okt → kvartalsbrevet (research + författande,
//     köar SAMTLIGA politiker; prenumeranterna får samma brev samma dag)
//
// runNewsletterSender + runQuarterlyDrain körs i VARJE daglig slot, i den
// ordningen (prenumeranter har prioritet över politiker-kön) — båda via
// Resend, no-op utan kö/RESEND_API_KEY.
//
// Klientfel rapporteras numera direkt till GitHub (gratis) via app-Workern,
// utan någon LLM-driven autofix — den gamla issue-fixern (Claude skrev om hela
// filer, ~$3-4/issue) är borttagen.

const QUARTERLY_CRON = "30 6 1 1,4,7,10 *";

export async function handleScheduled(event: ScheduledController, appEnv: AppEnv, ctx: ExecutionContext): Promise<void> {
  if (!appEnv.ANTHROPIC_API_KEY) {
    throw new Error("Kampanjkörningen kräver ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY)");
  }
  const env = appEnv as Env;

      const hour = new Date(event.scheduledTime).getUTCHours();
  ctx.waitUntil(
        (async () => {
          try {
            if (event.cron === QUARTERLY_CRON) { await runQuarterlyCampaign(env); return; }
            switch (hour) {
              case 5:  await runMonitor(env);        break;
              case 6:  await runLetterGenerator(env); break;
              case 7:  await runLetterSender(env);    break;
              case 8:  await runBounceSweep(env);     break;
            }
            // Prenumeranterna har prioritet: nyhetsbrevet dräneras FÖRE
            // politiker-kön i varje slot, så kvartalsdräneringen aldrig hinner
            // äta upp Resends dagskvot före ett nyhetsbrevsutskick.
            await runNewsletterSender(env);
            await runQuarterlyDrain(env);
          } catch (e) {
            // Fel i den asynkrona tasken inuti waitUntil() bubblar inte upp
            // till scheduled()s anropare, så de måste loggas explicit här.
            console.error(e);
            throw e;
          }
    })(),
  );
}
