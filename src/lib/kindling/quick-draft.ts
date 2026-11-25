import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, assertSameOrigin, clientIp, verifyTurnstile } from "@/lib/kindling/guard";
import type { AiResult } from "@/lib/kindling/ai";

/**
 * "Paste one message, get one draft" for visitors who have not built a week yet.
 * It is an open door to your AI quota, so it is limited per visitor and overall, and it keeps nothing.
 * The counters live in server memory, which resets when the server restarts or scales out, so also add a
 * rate limit in your host's firewall for real protection.
 */

const schema = z.object({ note: z.string().trim().min(8).max(600), turnstile: z.string().max(4096).default("") });

const perVisitor = new Map<string, { day: string; count: number }>();
let global = { day: "", count: 0 };

function limits() {
  return {
    visitor: Math.max(1, Number(process.env.QUICK_DRAFT_DAILY_LIMIT || 5)),
    overall: Math.max(1, Number(process.env.QUICK_DRAFT_GLOBAL_CAP || 300)),
  };
}

function visitorKey(): string {
  try {
    const request = getRequest();
    return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim() || "local";
  } catch {
    return "local";
  }
}

function allowed(): { ok: true } | { ok: false; error: string } {
  const day = new Date().toISOString().slice(0, 10);
  const { visitor, overall } = limits();
  if (global.day !== day) global = { day, count: 0 };
  if (global.count >= overall) return { ok: false, error: "The free try-out is busy today. Build your week to keep going, or come back tomorrow." };
  const key = visitorKey();
  const entry = perVisitor.get(key);
  if (!entry || entry.day !== day) {
    if (perVisitor.size > 5000) perVisitor.clear();
    perVisitor.set(key, { day, count: 1 });
  } else {
    if (entry.count >= visitor) return { ok: false, error: `That is ${visitor} quick drafts for today. Build your week to keep going, it takes two minutes.` };
    entry.count += 1;
  }
  global.count += 1;
  return { ok: true };
}

export type QuickDraftResult = (Extract<AiResult, { ok: true }> & { intent: "reply" | "schedule" | "quote"; needs: string[] }) | { ok: false; error: string };

export const quickDraft = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<QuickDraftResult> => {
    assertSameOrigin();
    if (!allow("quick-burst", clientIp(), 10, 60_000)) return { ok: false, error: "Too many requests. Wait a minute and try again." };
    if (!(await verifyTurnstile(data.turnstile))) return { ok: false, error: "Please complete the security check and try again." };
    const [core, needsModule] = await Promise.all([import("@/lib/kindling/ai-core.server"), import("@/lib/kindling/needs")]);
    const analysis = needsModule.analyze(data.note);
    const title = analysis.intent === "schedule" ? "The booking confirmation" : analysis.intent === "quote" ? "The quote scaffold" : "The reply desk";
    const input = {
      mode: "draft" as const,
      businessName: "",
      offer: "",
      toneLine: "Warm and plain. Short sentences. Sounds like one person, not a company.",
      tradeLabel: "Small business",
      workflowTitle: title,
      workflowIntent: "Reply to a customer message so the owner can check it and send it.",
      outputShape: "Only the message, ready to paste. Keep every [CHECK] marker. Never invent a price, time or promise.",
      promptTemplate: "",
      sourceText: data.note,
      extraRules: "",
      voiceSample: "",
      channel: "whatsapp" as const,
      useChannel: true,
      language: "match" as const,
      facts: [],
      learned: [],
      styleNotes: "",
    };
    // Without a live AI nothing leaves the server, so there is nothing to limit.
    if (core.hasProvider(input)) {
      const gate = allowed();
      if (!gate.ok) return gate;
    }
    const result = await core.generate(input);
    if (!result.ok) return result;
    return { ...result, intent: analysis.intent, needs: analysis.needs.map((n) => n.key) };
  });
