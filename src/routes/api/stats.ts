import { createFileRoute } from "@tanstack/react-router";
import { sameSecret } from "@/lib/kindling/guard";

/** The owner's numbers. Needs "Authorization: Bearer <CRON_SECRET>". Add ?days=7 for a shorter window (1 to 90, default 30). */
export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET ?? "";
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (!sameSecret(secret, given)) return new Response("Unauthorized", { status: 401 });
        const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30) || 30));
        const server = await import("@/lib/kindling/weekly.server");
        return Response.json(await server.eventStats(days), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
