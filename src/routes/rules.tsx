import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "@/components/kindling/rules";

export const Route = createFileRoute("/rules")({
  validateSearch: (search: Record<string, unknown>): { d?: string } => ({
    d: typeof search.d === "string" ? search.d : undefined,
  }),
  head: () => ({
    meta: [{ title: "House rules | Kindling" }, { name: "robots", content: "noindex" }],
  }),
  component: RulesPage,
});
