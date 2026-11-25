import { createFileRoute } from "@tanstack/react-router";
import { Pricing } from "@/components/kindling/pricing";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/pricing")({
  head: () => pageHead({ title: "Pricing | Kindling", description: "A free core and, if offered, one flat price. No charge per message and no contract in the app.", path: "/pricing" }),
  component: Pricing,
});
