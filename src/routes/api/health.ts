import { createFileRoute } from "@tanstack/react-router";
import { sameSecret } from "@/lib/kindling/guard";

/**
 * With no key it answers {ok:true}, which is all an uptime monitor needs.
 * With "Authorization: Bearer <CRON_SECRET>" it returns the full launch checklist (never any secret values).
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        const secret = process.env.CRON_SECRET ?? "";
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (!secret || !sameSecret(secret, given)) return Response.json({ ok: true }, { headers });
        const health = await import("@/lib/kindling/health.server");
        return Response.json(await health.runHealth(), { headers });
      },
    },
  },
});
