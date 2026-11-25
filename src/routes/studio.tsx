import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/kindling/studio";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/studio")({
  head: () => pageHead({ title: "Your week | Kindling", path: "/studio", index: false }),
  component: Studio,
});
