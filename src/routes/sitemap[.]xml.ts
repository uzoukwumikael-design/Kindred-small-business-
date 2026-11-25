import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_PATHS } from "@/lib/kindling/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
        const day = new Date().toISOString().slice(0, 10);
        const urls = PUBLIC_PATHS.map(
          (path) => `  <url><loc>${origin}${path === "/" ? "" : path}</loc><lastmod>${day}</lastmod></url>`,
        ).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
