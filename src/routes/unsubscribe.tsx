import { createFileRoute } from "@tanstack/react-router";
import { Unsubscribe } from "@/components/kindling/unsubscribe";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): { u?: string; t?: string } => ({
    u: typeof search.u === "string" ? search.u : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  head: () => ({ meta: [{ title: "Weekly email | Kindling" }, { name: "robots", content: "noindex" }] }),
  component: Unsubscribe,
});
