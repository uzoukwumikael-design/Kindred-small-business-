import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NotFound } from "@/components/kindling/not-found";
import { Shell } from "@/components/kindling/shell";
import appCss from "../styles.css?url";

const APP_NAME = "Kindling";
const DESCRIPTION =
  "Kindling helps a small shop install one AI workflow this week: a recipe, a prompt, and a house rule. No new software bill.";
// Set VITE_SITE_URL (for example https://kindling.example) so link previews get an absolute image address.
const SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(/\/$/, "");

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#F3EBDF" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: `${SITE}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: APP_NAME },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: `${SITE}/og.jpg` },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Shell>
          <Outlet />
        </Shell>
        <Scripts />
      </body>
    </html>
  ),
});
