import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/kindling/landing";
import { homeJsonLd, pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/")({
  head: () => {
    const head = pageHead({
      title: "Kindling: one AI job for your shop, checked before it sends",
      description:
        "Kindling helps a small shop install one AI workflow this week: a recipe, a prompt, and a house rule. Drafts for WhatsApp, text, email and DMs, with every unknown fact left as a bracket.",
      path: "/",
    });
    return { ...head, scripts: [{ type: "application/ld+json", children: homeJsonLd() }] };
  },
  component: Landing,
});
