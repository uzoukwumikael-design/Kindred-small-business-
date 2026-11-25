import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { allow, assertSameOrigin, clientIp, verifyTurnstile } from "@/lib/kindling/guard";

/**
 * The help page's contact form. Each message is posted as JSON to FEEDBACK_WEBHOOK_URL (a Slack or Discord
 * webhook, a Zapier or Make hook, a Formspree address, a Google Apps Script). With none set the form is hidden and the
 * page shows the contact email instead. Nothing is stored here.
 */

const schema = z.object({
  kind: z.enum(["question", "problem", "idea"]),
  message: z.string().trim().min(10).max(1500),
  replyTo: z.string().trim().max(120).default(""),
  page: z.string().trim().max(100).default(""),
  company: z.string().trim().max(0).default(""), // honeypot: real people leave this empty
  turnstile: z.string().max(4096).default(""),
});

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export const sendFeedback = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.safeParse(data))
  .handler(async ({ data }): Promise<FeedbackResult> => {
    assertSameOrigin();
    if (!data.success) {
      if (data.error.issues.some((i) => i.path[0] === "company")) return { ok: true }; // a bot: say nothing useful
      const short = data.error.issues.some((i) => i.path[0] === "message");
      return { ok: false, error: short ? "Please write a little more, at least a sentence." : "That did not look right. Check it and try again." };
    }
    const hook = process.env.FEEDBACK_WEBHOOK_URL;
    if (!hook) return { ok: false, error: "The form is not switched on. Please email us instead." };
    if (!allow("feedback", clientIp(), 5, 3_600_000)) return { ok: false, error: "Too many messages from this connection. Try again in an hour." };
    if (!(await verifyTurnstile(data.data.turnstile))) return { ok: false, error: "Please complete the security check and try again." };
    const { kind, message, replyTo, page } = data.data;
    if (replyTo && !/^\S+@\S+\.\S+$/.test(replyTo)) return { ok: false, error: "That reply address does not look right." };
    try {
      const response = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[${kind}] ${message}${replyTo ? `\nReply to: ${replyTo}` : ""}`, kind, message, replyTo, page, at: new Date().toISOString(), source: "kindling-help" }),
        signal: AbortSignal.timeout(8000),
      });
      return response.ok ? { ok: true } : { ok: false, error: "That did not go through. Please try again, or email us." };
    } catch {
      return { ok: false, error: "That did not go through. Please try again, or email us." };
    }
  });
