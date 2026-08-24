// Tail-konsument för politiker-Workern. Varje loggevent skrivs som ett eget
// JSON-objekt i R2, partitionerat på år/månad/dag så att en dags loggar går
// att lista utan att skanna hela bucketen.
//
// Workern deployades ursprungligen direkt från en maskin utan att källkoden
// låg i repot. Den här filen är rekonstruerad ur den deployade bundeln.

/**
 * Nyckel på formen `ÅÅÅÅ/MM/DD/<iso>-<index>-<uuid>.json`.
 *
 * Datumprefixet ger billig listning per dag. Index plus UUID gör nyckeln unik
 * även när flera event i samma batch delar millisekund — utan båda skriver
 * eventen över varandra.
 */
function objectKey(event, index) {
  const ts = Number(event?.eventTimestamp ?? Date.now());
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const iso = d.toISOString().replace(/[:.]/g, "-");
  return `${yyyy}/${mm}/${dd}/${iso}-${index}-${crypto.randomUUID()}.json`;
}

export default {
  async tail(events, env) {
    const writes = events.map((event, index) => {
      const key = objectKey(event, index);
      const body = JSON.stringify(event);
      return env.LOGS.put(key, body, {
        httpMetadata: { contentType: "application/json" },
        // Metadata går att filtrera på vid listning utan att hämta objektet.
        customMetadata: {
          scriptName: String(event?.scriptName ?? "unknown"),
          outcome: String(event?.outcome ?? "unknown"),
        },
      });
    });
    await Promise.all(writes);
  },
};
