import { getRequest } from "@tanstack/react-start/server";

/**
 * Small protections for the endpoints anyone on the internet can call.
 * Rate limits live in server memory, so they reset on a restart and are per server instance. They stop casual
 * abuse and runaway loops. For real protection, also set a rate limit in your host's firewall (see docs/LAUNCH.md).
 */

export function clientIp(): string {
  try {
    const request = getRequest();
    return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim() || "local";
  } catch {
    return "local";
  }
}

const windows = new Map<string, number[]>();

/** True if this caller may proceed. Allows `limit` calls per `windowMs` for each (name, key). */
export function allow(name: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const id = `${name}:${key}`;
  const recent = (windows.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    windows.set(id, recent);
    return false;
  }
  recent.push(now);
  windows.set(id, recent);
  if (windows.size > 20_000) {
    for (const [k, list] of windows) if (list.every((t) => now - t >= windowMs)) windows.delete(k);
  }
  return true;
}

export class Blocked extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Blocked";
  }
}

/**
 * Refuses a browser request that came from another website. Browsers always send Origin on a cross-site POST,
 * so a page on another domain cannot make a visitor's browser spend this site's AI quota. Requests with no Origin
 * (curl, mail apps, the host's cron) pass, and are covered by the rate limits instead.
 */
export function assertSameOrigin(): void {
  try {
    const request = getRequest();
    const origin = request.headers.get("origin");
    if (!origin) return;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    if (new URL(origin).host !== host) throw new Blocked("Cross-site request refused.");
  } catch (error) {
    if (error instanceof Blocked) throw error;
  }
}

/** Compares two secrets without leaking, through timing, how many leading characters matched. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks a Turnstile token with Cloudflare. Does nothing (returns true) unless TURNSTILE_SECRET_KEY is set, so the
 * feature is off by default. When it is set, a missing, used, expired or forged token is refused, and so is any
 * failure to reach Cloudflare, because letting bots through while the check is down defeats its purpose.
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    const ip = clientIp();
    if (ip && ip !== "local") body.set("remoteip", ip);
    const response = await fetch(process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
