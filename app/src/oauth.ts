import { randomId, hashPassword } from "../../shared/crypto";
import { getAccountByEmail, type Env } from "./db";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  clientIdEnvKey: keyof Env;
  clientSecretEnvKey: keyof Env;
}

// Webbinloggning stöds bara för de providers som fortfarande är konfigurerade
// i Workern. GitHub-login och extern kontolänkning är avvecklade.
const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scope: "openid email profile",
    clientIdEnvKey: "OAUTH_GOOGLE_CLIENT_ID",
    clientSecretEnvKey: "OAUTH_GOOGLE_CLIENT_SECRET",
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
    clientIdEnvKey: "OAUTH_MICROSOFT_CLIENT_ID",
    clientSecretEnvKey: "OAUTH_MICROSOFT_CLIENT_SECRET",
  },
};

const REDIRECT_BASE = "https://politiker.denied.se/api/oauth";

export function getAuthorizeUrl(provider: string, env: Env, state: string): string {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error("Okänd eller avvecklad inloggningsleverantör");
  const clientId = env[cfg.clientIdEnvKey] as string | undefined;
  if (!clientId) throw new Error(`${provider}-inloggning är inte konfigurerad än`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${REDIRECT_BASE}/${provider}/callback`,
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

async function exchangeCodeForUserInfo(
  provider: string,
  env: Env,
  code: string,
): Promise<{ providerUserId: string; email: string }> {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error("Okänd eller avvecklad inloggningsleverantör");
  const clientId = env[cfg.clientIdEnvKey] as string | undefined;
  const clientSecret = env[cfg.clientSecretEnvKey] as string | undefined;
  if (!clientId || !clientSecret) throw new Error(`${provider}-inloggning är inte konfigurerad än`);

  const redirectUri = `${REDIRECT_BASE}/${provider}/callback`;
  const tokenResp = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResp.ok) throw new Error(`Kunde inte hämta access token från ${provider}`);
  const tokenData = await tokenResp.json<{ access_token: string }>();

  const userResp = await fetch(cfg.userinfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "politiker" },
  });
  if (!userResp.ok) throw new Error(`Kunde inte hämta användarinfo från ${provider}`);
  const userData = await userResp.json<Record<string, unknown>>();

  const providerUserId = String(userData.sub ?? userData.id);
  const email = (userData.email as string | undefined) ?? null;
  if (!email) throw new Error(`Kunde inte hämta en verifierad e-postadress från ${provider}`);
  return { providerUserId, email };
}

export async function handleOAuthCallback(
  provider: string,
  env: Env,
  code: string,
): Promise<{ accountId: string }> {
  const { providerUserId, email } = await exchangeCodeForUserInfo(provider, env, code);

  const existingIdentity = await env.DB.prepare("SELECT account_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
    .bind(provider, providerUserId)
    .first<{ account_id: string }>();
  if (existingIdentity) {
    await env.DB.prepare("UPDATE oauth_identities SET provider_email = ? WHERE provider = ? AND provider_user_id = ?")
      .bind(email, provider, providerUserId)
      .run();
    return { accountId: existingIdentity.account_id };
  }

  // Auto-länka aldrig en ny extern identitet till ett existerande lokalt konto
  // enbart för att e-poststrängen matchar.
  const existingAccount = await getAccountByEmail(env.DB, email);
  if (existingAccount) {
    throw new Error("Det finns redan ett konto med den här e-postadressen. Logga in med e-post och lösenord.");
  }

  const accountId = randomId();
  const { hash, salt } = await hashPassword(randomId() + randomId());
  await env.DB.prepare(
    `INSERT INTO accounts (id, email, password_hash, password_salt, email_verified, daily_send_cap, created_at)
     VALUES (?, ?, ?, ?, 1, 200, ?)`,
  )
    .bind(accountId, email, hash, salt, Date.now())
    .run();

  await env.DB.prepare("INSERT INTO oauth_identities (id, account_id, provider, provider_user_id, provider_email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(randomId(), accountId, provider, providerUserId, email, Date.now())
    .run();

  return { accountId };
}

// Tillfälliga kompatibilitetsexporter för gamla routes i index.ts. Ingen av dem
// erbjuder längre kontolänkning. De kan tas bort helt när routefilen delas upp.
export function providerSharesLoginCallback(_provider: string): boolean { return false; }
export function getLinkAuthorizeUrl(_provider: string, _env: Env, _state: string): string {
  throw new Error("Kontolänkning är borttagen");
}
export async function handleOAuthLinkCallback(_provider: string, _env: Env, _code: string, _currentAccountId: string): Promise<void> {
  throw new Error("Kontolänkning är borttagen");
}
export async function getOAuthIdentities(_env: Env, _accountId: string): Promise<never[]> { return []; }
export async function unlinkOAuthIdentity(_env: Env, _accountId: string, _provider: string): Promise<void> {
  throw new Error("Kontolänkning är borttagen");
}
