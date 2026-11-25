import { createFileRoute } from "@tanstack/react-router";
import { allow, clientIp } from "@/lib/kindling/guard";

/**
 * Receives error reports from the browser. It writes one JSON line to the server log (visible in Vercel's logs) and,
 * if ERROR_WEBHOOK_URL is set, posts a short message there (a Slack or Discord style webhook works).
 */
export const Route = createFileRoute("/api/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
        if (origin) {
          try {
            if (new URL(origin).host !== host) return new Response(null, { status: 403 });
          } catch {
            return new Response(null, { status: 403 });
          }
        }
        if (!allow("client-error", clientIp(), 30, 3_600_000)) return new Response(null, { status: 429 });
        const raw = await request.text();
        if (raw.length > 4096) return new Response(null, { status: 413 });
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response(null, { status: 400 });
        }
        const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
        const entry = {
          type: "client-error",
          message: text(body.message, 300),
          stack: text(body.stack, 900),
          where: text(body.where, 40),
          path: text(body.path, 120),
          ts: new Date().toISOString(),
        };
        if (!entry.message) return new Response(null, { status: 400 });
        console.error(JSON.stringify(entry));
        const hook = process.env.ERROR_WEBHOOK_URL;
        if (hook && allow("error-hook", "all", 20, 3_600_000)) {
          try {
            await fetch(hook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: `Kindling error on ${entry.path || "/"}: ${entry.message}`, ...entry }),
              signal: AbortSignal.timeout(5000),
            });
          } catch {
            // the alert failing must not matter to the visitor
          }
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
