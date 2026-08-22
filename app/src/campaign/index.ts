import { runMonitor } from "./monitor";
import { runLetterGenerator } from "./letter-generator";
import { runLetterSender } from "./letter-sender";
import { runNewsletterSender } from "./newsletter-sender";
import { runQuarterlyCampaign, runQuarterlyDrain } from "./quarterly-campaign";
import { runBounceSweep } from "./bounce-sweep";

import type { Env as AppEnv } from "../db";
export type Env = AppEnv & { ANTHROPIC_API_KEY: string };

// Cron-tider (UTC):
//   05:00 dagligen → monitor
//   06:00 lördagar → letter-gen (veckovis; endast utkast för manuell granskning)
//   07:00 dagligen → letter-sender (skickar endast manuellt godkända brev)
//   08:00 dagligen → bounce-sweep
//   06:30 den 1:a i jan/apr/jul/okt → kvartalsbrevet
//
// Bevakningen är fortsatt daglig så att källhistoriken kan knytas ihop över tid,
// men redaktionen producerar inte dagliga brev. AI:n har inget eget beständigt
// minne mellan körningar; sammanhanget ska komma från lagrade, verifierbara
// källposter i D1 och från den manuella granskningsprocessen.
//
// runNewsletterSender + runQuarterlyDrain körs i varje daglig slot.

const QUARTERLY_CRON = "30 6 1 1,4,7,10 *";
const WEEKLY_LETTER_CRON = "0 6 * * SAT";

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
        if (event.cron === WEEKLY_LETTER_CRON) {
          await runLetterGenerator(env);
          await runNewsletterSender(env);
          await runQuarterlyDrain(env);
          return;
        }
        switch (hour) {
          case 5: await runMonitor(env); break;
          case 7: await runLetterSender(env); break;
          case 8: await runBounceSweep(env); break;
        }
        await runNewsletterSender(env);
        await runQuarterlyDrain(env);
      } catch (e) {
        console.error(e);
        throw e;
      }
    })(),
  );
}
