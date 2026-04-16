import { getConfig, getTradovateBaseUrl } from "../core/config";
import { prisma } from "../db/prisma";

interface TokenResponse {
  accessToken: string;
  expirationTime: string; // ISO string
  mdAccessToken?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: Date;
  accountId: number;
}

let tokenCache: TokenCache | null = null;
let renewalTimer: ReturnType<typeof setInterval> | null = null;

export async function requestAccessToken(): Promise<TokenCache> {
  const cfg = getConfig();
  const baseUrl = getTradovateBaseUrl();
  const body = {
    name: cfg.TRADOVATE_USERNAME,
    password: cfg.TRADOVATE_PASSWORD,
    appId: cfg.TRADOVATE_APP_ID,
    appSecret: cfg.TRADOVATE_APP_SECRET,
    cid: cfg.TRADOVATE_CID,
    sec: cfg.TRADOVATE_APP_SECRET,
    deviceId: cfg.TRADOVATE_DEVICE_ID,
  };

  const res = await fetch(`${baseUrl}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tradovate auth failed ${res.status}: ${text}`);
  }

  const data: TokenResponse = await res.json();

  // Fetch account id
  const acctRes = await fetch(`${baseUrl}/account/list`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  const accounts: Array<{ id: number; name: string; active: boolean }> =
    await acctRes.json();

  const account =
    cfg.TRADOVATE_ACCOUNT_ID != null
      ? accounts.find((a) => a.id === cfg.TRADOVATE_ACCOUNT_ID)
      : accounts.find((a) => a.active) ?? accounts[0];

  if (!account) throw new Error("No Tradovate account found");

  const expiresAt = new Date(data.expirationTime);

  await prisma.authToken.upsert({
    where: { accountId: account.id },
    update: { accessToken: data.accessToken, expiresAt },
    create: { accountId: account.id, accessToken: data.accessToken, expiresAt },
  });

  tokenCache = { accessToken: data.accessToken, expiresAt, accountId: account.id };
  return tokenCache;
}

async function renewAccessToken(): Promise<void> {
  if (!tokenCache) return;

  const res = await fetch(`${getTradovateBaseUrl()}/auth/renewaccesstoken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenCache.accessToken}`,
    },
  });

  if (!res.ok) {
    // Full re-auth on renewal failure
    await requestAccessToken();
    return;
  }

  const data: TokenResponse = await res.json();
  const expiresAt = new Date(data.expirationTime);

  tokenCache = { ...tokenCache, accessToken: data.accessToken, expiresAt };

  await prisma.authToken.update({
    where: { accountId: tokenCache.accountId },
    data: { accessToken: data.accessToken, expiresAt },
  });
}

export async function getValidToken(): Promise<TokenCache> {
  if (!tokenCache) {
    // Try restoring from DB first
    const stored = await prisma.authToken.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (stored && stored.expiresAt > new Date(Date.now() + 60_000)) {
      tokenCache = {
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt,
        accountId: stored.accountId,
      };
      return tokenCache;
    }
    return requestAccessToken();
  }

  const secsUntilExpiry = (tokenCache.expiresAt.getTime() - Date.now()) / 1000;
  if (secsUntilExpiry < 60) {
    await renewAccessToken();
  }

  return tokenCache!;
}

export function startAutoRenewal(): void {
  if (renewalTimer) return;
  renewalTimer = setInterval(async () => {
    if (tokenCache) await getValidToken().catch(console.error);
  }, 30_000);
}

export function getTokenCache(): TokenCache | null {
  return tokenCache;
}
