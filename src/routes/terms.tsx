import { createFileRoute } from "@tanstack/react-router";
import { Terms } from "@/components/kindling/terms";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/terms")({
  head: () => pageHead({ title: "Terms of use | Kindling", description: "The plain version of the terms: you check and you send, fair use, accounts, and the service as it is.", path: "/terms" }),
  component: Terms,
});
