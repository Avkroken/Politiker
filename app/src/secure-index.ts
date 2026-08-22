import baseApp from "./index";
import { getSessionContext, writeSession } from "./auth";
import { pruneVisits } from "./visits";
import type { Env } from "./db";
import type { SendJobMessage } from "../../shared/types";
import { randomId } from "../../shared/crypto";
import { decryptLetterData, encryptLetterData, enforceLetterRetention, protectStoredLetterData } from "./letter-privacy";

export { CredentialRateLimiter } from "./rate-limiter";

const FRESH_AUTH_MS = 15 * 60 * 1000;
const ALLOWED_RETENTION_MS = new Set([300000, 86400000, 259200000, 604800000]);

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function apiKeyRouteAllowed(method: string, pathname: string): boolean {
  if (method === "GET" && ["/api/me", "/api/areas", "/api/parties", "/api/roles", "/api/provider-ceilings", "/api/send-jobs"].includes(pathname)) return true;
  if (method === "GET" && pathname === "/api/politicians/search") return true;
  if (method === "POST" && ["/api/recipients/count", "/api/send"].includes(pathname)) return true;
  if (method === "PATCH" && /^\/api\/send-jobs\/[^/]+\/rate$/.test(pathname)) return true;
  return false;
}

function needsFreshSession(method: string, pathname: string): boolean {
  if (method === "POST" && [
    "/api/totp/setup", "/api/totp/confirm", "/api/totp/disable", "/api/set-password", "/api/api-keys", "/api/mail-credentials",
  ].includes(pathname)) return true;
  if (method === "DELETE" && (/^\/api\/api-keys\/[^/]+$/.test(pathname)
    || /^\/api\/oauth-identities\/[a-z]+$/.test(pathname)
    || /^\/api\/mail-credentials\/[^/]+$/.test(pathname))) return true;
  if (method === "GET" && /^\/api\/(?:oauth-link\/[a-z]+|oauth-mail\/microsoft)\/start$/.test(pathname)) return true;
  return false;
}

async function takeRateLimit(env: Env, key: string, capacity: number, refillPerMinute: number): Promise<boolean> {
  const id = env.RATE_LIMITER.idFromName(`web-abuse:${key}`);
  try {
    const response = await env.RATE_LIMITER.get(id).fetch("https://rate-limiter/acquire", { method: "POST", body: JSON.stringify({ capacity, refillPerMinute }) });
    const result = await response.json<{ granted?: boolean }>();
    return result.granted === true;
  } catch { return false; }
}

async function allowPublicWrite(req: Request, env: Env, pathname: string): Promise<boolean> {
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  if (pathname === "/api/feedback") return (await takeRateLimit(env, `feedback:${ip}`, 10, 2)) && (await takeRateLimit(env, "feedback:global", 120, 60));
  return (await takeRateLimit(env, `client-error:${ip}`, 30, 10)) && (await takeRateLimit(env, "client-error:global", 300, 120));
}

async function upgradeOAuthSession(req: Request, env: Env, response: Response): Promise<void> {
  const pathname = new URL(req.url).pathname;
  if (req.method !== "GET" || !/^\/api\/oauth\/[a-z]+\/callback$/.test(pathname) || response.status !== 302) return;
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const token = setCookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!token) return;
  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw || raw.startsWith("{")) return;
  try { await writeSession(env, token, raw, Date.now()); }
  catch (error) { await env.SESSIONS.delete(`session:${token}`).catch(() => {}); throw error; }
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function publishEncryptedLetter(req: Request, env: Env, letterId: string): Promise<Response> {
  const session = await getSessionContext(env, getCookie(req, "session"));
  if (!session) return json({ error: "Inte inloggad" }, 401);
  const accountId = String(session.account?.id ?? "");
  const letter = await env.DB.prepare(
    "SELECT l.html_body FROM letters l JOIN send_jobs sj ON sj.letter_id=l.id WHERE l.id=? AND sj.account_id=? LIMIT 1",
  ).bind(letterId, accountId).first<{ html_body: string }>();
  if (!letter) return json({ error: "Brevet hittades inte" }, 404);
  if (await env.DB.prepare("SELECT id FROM public_letters WHERE source='user' AND account_id=?").bind(accountId).first()) return json({ error: "Du har redan publicerat ett brev" }, 409);
  const body = await decryptLetterData(env, letter.html_body);
  if (!body) return json({ error: "Brevets innehåll har raderats enligt lagringspolicyn" }, 410);
  const subject = (body.replace(/[<>]/g, "").split(/\n/).find((line) => line.trim().length > 20) ?? "Medborgarbrev").trim().slice(0, 100);
  const pubId = randomId();
  await env.DB.prepare("INSERT INTO public_letters (id,source,account_id,subject,body,area_name,published_at) VALUES (?,'user',?,?,?,NULL,?)")
    .bind(pubId, accountId, subject, await encryptLetterData(env, body.replace(/[<>]/g, "")), Date.now()).run();
  return json({ ok: true, id: pubId });
}

async function decryptedPublicLetters(env: Env, url: URL): Promise<Response> {
  const detail = url.pathname.match(/^\/api\/public\/letters\/(.+)$/);
  if (detail) {
    const row = await env.DB.prepare("SELECT subject,body FROM public_letters WHERE id=?").bind(detail[1]).first<{ subject: string; body: string }>();
    if (!row) return json({ error: "Hittades inte" }, 404);
    return json({ subject: row.subject, body: await decryptLetterData(env, row.body) });
  }
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
  const { results } = await env.DB.prepare("SELECT id,source,subject,body,area_name,published_at FROM public_letters ORDER BY published_at DESC LIMIT 20 OFFSET ?")
    .bind(page * 20).all<{ id: string; source: string; subject: string; body: string; area_name: string | null; published_at: number }>();
  const letters = await Promise.all(results.map(async (row) => ({ ...row, excerpt: (await decryptLetterData(env, row.body)).slice(0, 400), body: undefined })));
  return json({ letters });
}

function requestedRetentionMs(req: Request): number {
  const raw = req.headers.get("X-Letter-Retention-Ms") ?? getCookie(req, "letter_retention_ms") ?? "300000";
  const value = Number(raw);
  return ALLOWED_RETENTION_MS.has(value) ? value : 300000;
}

async function protectCreatedSendJob(req: Request, env: Env, response: Response): Promise<void> {
  if (!response.ok) return;
  const data = await response.clone().json<{ sendJobId?: string }>().catch(() => ({}));
  if (!data.sendJobId) return;
  const row = await env.DB.prepare("SELECT l.id,l.html_body FROM letters l JOIN send_jobs sj ON sj.letter_id=l.id WHERE sj.id=?")
    .bind(data.sendJobId).first<{ id: string; html_body: string }>();
  if (!row) return;
  await env.DB.batch([
    env.DB.prepare("UPDATE letters SET html_body=? WHERE id=?").bind(await encryptLetterData(env, row.html_body), row.id),
    env.DB.prepare("UPDATE send_jobs SET content_retention_ms=? WHERE id=?").bind(requestedRetentionMs(req), data.sendJobId),
  ]);
}

async function secureFetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const bearer = req.headers.get("Authorization")?.startsWith("Bearer ") === true;

  if (bearer && url.pathname.startsWith("/api/") && !apiKeyRouteAllowed(req.method, url.pathname)) {
    const session = await getSessionContext(env, getCookie(req, "session"));
    if (!session) return withSecurityHeaders(json({ error: "API-nyckeln saknar behörighet för den här operationen" }, 403));
  }
  if (needsFreshSession(req.method, url.pathname)) {
    const session = await getSessionContext(env, getCookie(req, "session"));
    if (!session) return withSecurityHeaders(json({ error: "Den här säkerhetsändringen kräver en vanlig webbsession" }, 403));
    if (Date.now() - session.authenticatedAt > FRESH_AUTH_MS) return withSecurityHeaders(json({ error: "Logga ut och in igen innan du ändrar kontots säkerhetsinställningar" }, 403));
  }
  if (req.method === "POST" && (url.pathname === "/api/feedback" || url.pathname === "/api/client-error")) {
    const maxBytes = url.pathname === "/api/feedback" ? 64 * 1024 : 32 * 1024;
    const contentLength = Number(req.headers.get("Content-Length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) return withSecurityHeaders(json({ error: "För stor begäran" }, 413));
    if (!(await allowPublicWrite(req, env, url.pathname))) return withSecurityHeaders(json({ error: "För många anrop — försök igen senare" }, 429));
  }

  const publish = req.method === "POST" ? url.pathname.match(/^\/api\/letters\/([^/]+)\/publish$/) : null;
  if (publish) return withSecurityHeaders(await publishEncryptedLetter(req, env, publish[1]));

  const response = await baseApp.fetch(req, env, ctx);
  try { await upgradeOAuthSession(req, env, response); }
  catch { return withSecurityHeaders(json({ error: "Kontot kunde inte skapa en giltig session" }, 403)); }

  if (req.method === "POST" && url.pathname === "/api/send") await protectCreatedSendJob(req, env, response);
  if (req.method === "GET" && /^\/api\/public\/letters(?:\/.*)?$/.test(url.pathname) && response.ok) {
    return withSecurityHeaders(await decryptedPublicLetters(env, url));
  }
  return withSecurityHeaders(response);
}

export default {
  fetch: secureFetch,
  queue: baseApp.queue,
  scheduled: async (event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(pruneVisits(env));
    await baseApp.scheduled(event, env, ctx);
    await protectStoredLetterData(env);
    await enforceLetterRetention(env);
  },
} satisfies ExportedHandler<Env, SendJobMessage>;
