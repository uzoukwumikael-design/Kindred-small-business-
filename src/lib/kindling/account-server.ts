import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, assertSameOrigin, clientIp } from "@/lib/kindling/guard";

/** Thin server functions. The real work lives in weekly.server.ts and is loaded only on the server. */

function origin(): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

export type ServiceInfo = {
  ai: string[];
  weeklyEmail: boolean;
  emailProvider: string | null;
  accountDelete: boolean;
  feedback: boolean;
};

export const serviceInfo = createServerFn({ method: "GET" }).handler(async (): Promise<ServiceInfo> => {
  const server = await import("@/lib/kindling/weekly.server");
  return {
    ai: server.aiProviders(),
    weeklyEmail: server.weeklyReady(),
    emailProvider: server.emailProvider(),
    accountDelete: server.accountDeleteReady(),
    feedback: Boolean(process.env.FEEDBACK_WEBHOOK_URL),
  };
});

const tokenSchema = z.object({ token: z.string().min(10).max(4000) });

export const sendTestWeekly = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    assertSameOrigin();
    if (!allow("test-email", clientIp(), 5, 3_600_000)) return { ok: false as const, error: "Too many test emails. Try again in an hour." };
    const server = await import("@/lib/kindling/weekly.server");
    return server.sendTest(data.token, origin());
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    assertSameOrigin();
    if (!allow("delete-account", clientIp(), 5, 3_600_000)) return { ok: false as const, error: "Too many tries. Try again in an hour." };
    const server = await import("@/lib/kindling/weekly.server");
    return server.deleteAccount(data.token);
  });

const unsubSchema = z.object({ u: z.string().max(60), t: z.string().max(200) });

export const unsubscribeWeekly = createServerFn({ method: "POST" })
  .validator((data: unknown) => unsubSchema.parse(data))
  .handler(async ({ data }) => {
    assertSameOrigin();
    if (!allow("unsubscribe", clientIp(), 30, 3_600_000)) return { ok: false };
    const server = await import("@/lib/kindling/weekly.server");
    return { ok: await server.unsubscribe(data.u, data.t) };
  });

const noteSchema = z.object({ note: z.string().max(1500) });

/** Which shop facts a pasted message seems to need. Cheap, no AI, nothing stored. */
export const analyzeNote = createServerFn({ method: "POST" })
  .validator((data: unknown) => noteSchema.parse(data))
  .handler(async ({ data }) => {
    assertSameOrigin();
    // Cheap but not free, and it fires as someone types, so allow plenty and stop loops.
    if (!allow("analyze", clientIp(), 90, 60_000)) return { needs: [], intent: "reply" as const, source: "none" as const };
    const needs = await import("@/lib/kindling/needs");
    return needs.analyze(data.note);
  });
