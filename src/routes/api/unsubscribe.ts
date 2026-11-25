import { createFileRoute } from "@tanstack/react-router";
import { allow, clientIp } from "@/lib/kindling/guard";

/** One-click unsubscribe for mail apps (RFC 8058). Mail apps send a POST to the link inside the email. */
export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!allow("unsubscribe-api", clientIp(), 60, 3_600_000)) return new Response("Too many requests", { status: 429 });
        const url = new URL(request.url);
        const server = await import("@/lib/kindling/weekly.server");
        const ok = await server.unsubscribe(url.searchParams.get("u") ?? "", url.searchParams.get("t") ?? "");
        return new Response(ok ? "Unsubscribed" : "Invalid link", { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
