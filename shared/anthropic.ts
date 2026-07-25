// Delad Anthropic Messages-klient för campaign-Workern. Tidigare fanns tre
// nästan identiska kopior (letter-generator, issue-fixer, bounce-sweep) som
// drev isär i felhantering — en plats istället, så validering/retry-logik
// gäller alla anrop lika.

export const ANTHROPIC_HAIKU = "claude-haiku-4-5-20251001";
export const ANTHROPIC_SONNET = "claude-sonnet-4-6";

// Max API-anrop per UTC-dag. Med 30 anrop/dag och en 31-dagarsmånad ger det
// ~930 anrop/månad — håller oss långt under Anthropics konfigurerade limit.
export const DAILY_CALL_BUDGET = 30;

// Alla tre cron-jobb delar samma dagsbudget. letter-generator (körs först och
// slukar flest anrop) ska lämna kvar utrymme åt bounce-sweep och kvartalsbrevet
// som körs senare på dagen och bara gör ETT anrop var. Därför får det ett lägre
// tak än totalen. Reserven täcker båda senare jobben (max 2 anrop, endast på
// kvartalsstarten sammanfaller de) plus marginal för eventuella retries.
export const LETTER_GEN_CALL_BUDGET = DAILY_CALL_BUDGET - 4;

export class AnthropicBudgetExceededError extends Error {
  constructor() {
    super("Anthropic daily call budget exceeded — försöker igen imorgon");
    this.name = "AnthropicBudgetExceededError";
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function callAnthropic(
  apiKey: string,
  opts: { model: string; maxTokens: number; prompt: string; budget?: number },
  db: D1Database,
): Promise<string> {
  const today = todayUtc();
  const budget = opts.budget ?? DAILY_CALL_BUDGET;

  // Atomisk budgetreservering: försök ta EN budgetenhet INNAN API-anropet.
  // Om budget redan uppnådd returnerar UPDATE:n noll rader (call_count >= budget
  // i WHERE-villkoret misslyckas) — då kastar vi AnthropicBudgetExceededError.
  // Reserveringen behålls oavsett om fetch/parsing lyckas eller inte — ingen
  // rollback vid fel, så att misslyckade anrop inte kan köras om i oändlighet.
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError("Anthropic budget must be a non-negative integer");
  }
  if (budget === 0) {
    throw new AnthropicBudgetExceededError();
  }
  const reservation = await db
    .prepare(
      "INSERT INTO daily_api_usage (date, call_count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET call_count = call_count + 1 WHERE call_count < ?",
    )
    .bind(today, budget)
    .run();
  if (reservation.meta.changes === 0) {
    throw new AnthropicBudgetExceededError();
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { content?: Array<{ text: string }> };
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Anthropic: tomt svar");

  return text.trim();
}
