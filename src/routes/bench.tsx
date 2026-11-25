import { createFileRoute } from "@tanstack/react-router";
import { Bench } from "@/components/kindling/bench";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/bench")({
  head: () => pageHead({ title: "The bench | Kindling", path: "/bench", index: false }),
  component: Bench,
});
