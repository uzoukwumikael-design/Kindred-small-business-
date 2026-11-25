import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, assertSameOrigin, clientIp } from "@/lib/kindling/guard";

const inputSchema = z.object({
  mode: z.enum(["sharpen", "draft"]),
  businessName: z.string().trim().max(80),
  offer: z.string().trim().max(240),
  toneLine: z.string().trim().max(240),
  tradeLabel: z.string().trim().max(80),
  workflowTitle: z.string().trim().max(120),
  workflowIntent: z.string().trim().max(700),
  outputShape: z.string().trim().max(400),
  promptTemplate: z.string().trim().max(5000),
  sourceText: z.string().trim().max(4000),
  extraRules: z.string().trim().max(1500).default(""),
  voiceSample: z.string().trim().max(800).default(""),
  channel: z.enum(["whatsapp", "text", "email", "dm"]).default("whatsapp"),
  useChannel: z.boolean().default(false),
  language: z.enum(["english", "pidgin", "yoruba", "igbo", "hausa", "match"]).default("english"),
  facts: z
    .array(
      z.object({
        key: z.string().trim().max(20).default("custom"),
        label: z.string().trim().max(40),
        value: z.string().trim().max(300),
        checkedOn: z.string().trim().max(10).default(""),
      }),
    )
    .max(20)
    .default([]),
  learned: z.array(z.string().trim().max(400)).max(3).default([]),
  styleNotes: z.string().trim().max(500).default(""),
});

export type AiInput = z.infer<typeof inputSchema>;

export type AiResult =
  | { ok: true; text: string; source: "live" | "template"; redacted: number; notes?: string[] }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Per-visitor daily allowance (server side)                           */
/* ------------------------------------------------------------------ */

const DAILY_LIMIT = 15;
const hits = new Map<string, { day: string; count: number }>();

function clientKey(): string {
  try {
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-for");
    return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim() || "local";
  } catch {
    return "local";
  }
}

function overLimit(key: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = hits.get(key);
  if (!entry || entry.day !== day) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { day, count: 1 });
    return false;
  }
  if (entry.count >= DAILY_LIMIT) return true;
  entry.count += 1;
  return false;
}


export const askKindling = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data: rawData }): Promise<AiResult> => {
    assertSameOrigin();
    if (!allow("draft-burst", clientIp(), 20, 60_000)) return { ok: false, error: "Too many requests. Wait a minute and try again." };
    const core = await import("@/lib/kindling/ai-core.server");
    const { data, redacted } = core.scrub(rawData);
    if (data.mode === "draft" && data.sourceText.length < 8) {
      return { ok: false, error: "Paste a real note first. A sentence is enough." };
    }
    // With no live AI connected nothing leaves the server, so the daily limit does not apply.
    if (!core.hasProvider(data)) return core.template(data, redacted);

    if (overLimit(clientKey())) {
      return {
        ok: false,
        error: "That is today's live-draft allowance used up. The prompt still works in the chat tool you already use.",
      };
    }
    return core.runLive(data, redacted);
  });
