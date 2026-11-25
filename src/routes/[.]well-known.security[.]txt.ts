import { createFileRoute } from "@tanstack/react-router";

/** Tells security researchers how to report a problem (RFC 9116). Shown only when a contact address is set. */
export const Route = createFileRoute("/.well-known/security.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const contact = (process.env.VITE_CONTACT_EMAIL || (import.meta.env?.VITE_CONTACT_EMAIL as string | undefined) || "").trim();
        if (!contact) return new Response("Not found", { status: 404 });
        const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
        const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
        const body = [
          `Contact: mailto:${contact}`,
          `Expires: ${expires}`,
          "Preferred-Languages: en",
          `Canonical: ${origin}/.well-known/security.txt`,
          "",
        ].join("\n");
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
      },
    },
  },
});
