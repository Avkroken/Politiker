// Delad Anthropic Messages-klient för campaign-Workern. Tidigare fanns tre
// nästan identiska kopior (letter-generator, issue-fixer, bounce-sweep) som
// drev isär i felhantering — en plats istället, så validering/retry-logik
// gäller alla anrop lika.

export const ANTHROPIC_HAIKU = "claude-haiku-4-5-20251001";
export const ANTHROPIC_SONNET = "claude-sonnet-4-6";

// Max API-anrop per UTC-dag. Med 30 anrop/dag och en 31-dagarsmånad ger det
// ~930 anrop/månad — håller oss långt under Anthropics konfigurerade limit.
export const DAILY_CALL_BUDGET = 30;

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
  opts: { model: string; maxTokens: number; prompt: string },
  db: D1Database,
): Promise<string> {
  const today = todayUtc();

  // Kontrollera daglig budget
  const row = await db
    .prepare("SELECT call_count FROM daily_api_usage WHERE date = ?")
    .bind(today)
    .first<{ call_count: number }>();
  const currentCount = row?.call_count ?? 0;
  if (currentCount >= DAILY_CALL_BUDGET) {
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

  // Räkna upp anropet efter lyckat svar
  await db
    .prepare(
      "INSERT INTO daily_api_usage (date, call_count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET call_count = call_count + 1",
    )
    .bind(today)
    .run();

  return text.trim();
}
