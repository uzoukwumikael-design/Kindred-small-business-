import { createFileRoute } from "@tanstack/react-router";
import { SharePage } from "@/components/kindling/share-page";

export const Route = createFileRoute("/share")({
  validateSearch: (search: Record<string, unknown>): { title?: string; text?: string; url?: string } => ({
    title: typeof search.title === "string" ? search.title.slice(0, 300) : undefined,
    text: typeof search.text === "string" ? search.text.slice(0, 3000) : undefined,
    url: typeof search.url === "string" ? search.url.slice(0, 500) : undefined,
  }),
  head: () => ({ meta: [{ title: "Shared message | Kindling" }, { name: "robots", content: "noindex" }] }),
  component: SharePage,
});
