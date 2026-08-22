import { runBounceSweep } from "./bounce-sweep";

import type { Env as AppEnv } from "../db";
export type Env = AppEnv;

// Endast tekniskt underhåll körs schemalagt här.
// Politikerkontakt producerar, publicerar eller skickar inga egna politiska brev.
// Användarnas utskick skapas och initieras alltid av användarna själva.

export async function handleScheduled(event: ScheduledController, env: AppEnv, ctx: ExecutionContext): Promise<void> {
  const hour = new Date(event.scheduledTime).getUTCHours();
  if (hour === 8) ctx.waitUntil(runBounceSweep(env));
}
