import { createFileRoute } from "@tanstack/react-router";
import { Join } from "@/components/kindling/join";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({ meta: [{ title: "Crew invite | Kindling" }, { name: "robots", content: "noindex" }] }),
  component: Join,
});
