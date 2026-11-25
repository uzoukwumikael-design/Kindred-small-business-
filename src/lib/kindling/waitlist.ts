import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, assertSameOrigin, clientIp, verifyTurnstile } from "@/lib/kindling/guard";

/**
 * Email capture. Kindling has no database, so each sign-up is posted as JSON to a webhook you control
 * (Formspree, Zapier, Make, a Google Apps Script, anything that accepts a POST).
 * Set WAITLIST_WEBHOOK_URL on the host. With it unset the form is not shown at all.
 */

export type WaitlistResult = { ok: true } | { ok: false; error: string };

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  trade: z.string().trim().max(40).default(""),
  consent: z.literal(true),
  turnstile: z.string().max(4096).default(""),
  company: z.string().trim().max(0).default(""), // honeypot: real people leave this empty
});

export const waitlistStatus = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: Boolean(process.env.WAITLIST_WEBHOOK_URL),
}));

const hits = new Map<string, { day: string; count: number }>();

function tooMany(): boolean {
  let key = "local";
  try {
    const request = getRequest();
    key = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
  } catch {
    key = "local";
  }
  const day = new Date().toISOString().slice(0, 10);
  const entry = hits.get(key);
  if (!entry || entry.day !== day) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { day, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.safeParse(data))
  .handler(async ({ data }): Promise<WaitlistResult> => {
    assertSameOrigin();
    if (!allow("waitlist-burst", clientIp(), 5, 60_000)) return { ok: false, error: "Too many tries. Wait a minute and try again." };
    if (!data.success) {
      const honeypot = data.error.issues.some((issue) => issue.path[0] === "company");
      // Pretend success to bots, tell humans what is wrong with the address.
      const noConsent = data.error.issues.some((issue) => issue.path[0] === "consent");
      if (honeypot) return { ok: true };
      return { ok: false, error: noConsent ? "Tick the box to say you want these emails." : "That email address doesn't look right." };
    }
    if (!(await verifyTurnstile(data.data.turnstile))) return { ok: false, error: "Please complete the security check and try again." };
    const url = process.env.WAITLIST_WEBHOOK_URL;
    if (!url) return { ok: false, error: "Sign-ups are not switched on yet." };
    if (tooMany()) return { ok: false, error: "Too many tries from this connection. Try again tomorrow." };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: data.data.email,
          trade: data.data.trade,
          source: "kindling",
          consent: {
            given: true,
            text: "Yes, email me when a new workflow is added. I can unsubscribe at any time.",
          },
          at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { ok: false, error: "That didn't go through. Please try again in a minute." };
      return { ok: true };
    } catch {
      return { ok: false, error: "That didn't go through. Please try again in a minute." };
    }
  });
