import { createFileRoute } from "@tanstack/react-router";
import { EVENTS } from "@/lib/kindling/events";
import { allow, clientIp } from "@/lib/kindling/guard";

export const Route = createFileRoute("/api/event")({
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
        // The address is used only to slow a loop down in memory. It is never stored with the count.
        if (!allow("event", clientIp(), 300, 3_600_000)) return new Response(null, { status: 429 });
        let event = "";
        try {
          event = String(((await request.json()) as { event?: unknown }).event ?? "");
        } catch {
          return new Response(null, { status: 400 });
        }
        if (!(EVENTS as readonly string[]).includes(event)) return new Response(null, { status: 400 });
        const server = await import("@/lib/kindling/weekly.server");
        await server.bumpEvent(event);
        return new Response(null, { status: 204 });
      },
    },
  },
});
