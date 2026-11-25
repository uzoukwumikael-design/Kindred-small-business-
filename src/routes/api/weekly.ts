import { createFileRoute } from "@tanstack/react-router";
import { sameSecret } from "@/lib/kindling/guard";

/**
 * Called once a day by Vercel Cron (see vercel.json). Sends the weekly summary to everyone who is due.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set on the project.
 */
export const Route = createFileRoute("/api/weekly")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET ?? "";
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (!sameSecret(secret, given)) return new Response("Unauthorized", { status: 401 });
        const server = await import("@/lib/kindling/weekly.server");
        const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
        const result = await server.runWeekly(origin);
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
