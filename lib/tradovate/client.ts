import { getTradovateBaseUrl } from "../core/config";
import { getValidToken } from "./auth";

async function tradovateRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = await getValidToken();

  const res = await fetch(`${getTradovateBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Force re-auth once on 401
    const { getValidToken: gvt, requestAccessToken } = await import("./auth");
    await requestAccessToken();
    const { accessToken: newToken } = await gvt();
    const retry = await fetch(`${getTradovateBaseUrl()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Tradovate ${path} ${retry.status}: ${text}`);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tradovate ${path} ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function tradovateGet<T>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = params
    ? `${path}?${new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        )
      )}`
    : path;
  return tradovateRequest<T>(url, { method: "GET" });
}

export async function tradovatePost<T>(
  path: string,
  body: unknown
): Promise<T> {
  return tradovateRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
