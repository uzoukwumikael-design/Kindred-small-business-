import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /account",
          "Disallow: /studio",
          "Disallow: /bench",
          "Disallow: /share",
          "Disallow: /join",
          "Disallow: /rules",
          "Disallow: /unsubscribe",
          "Disallow: /reset-password",
          "Disallow: /api/",
          "",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
