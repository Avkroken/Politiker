import type { Env as AppEnv } from "../db";
export type Env = AppEnv;

// Politikerkontakt har ingen autonom kampanj eller egen politisk publicering.
// Den schemalagda huvud-Workern används fortfarande av index.ts för att
// återuppta användarinitierade flerdagarsutskick; här finns avsiktligt inget
// eget innehåll eller utskick.
export async function handleScheduled(_event: ScheduledController, _env: AppEnv, _ctx: ExecutionContext): Promise<void> {}
