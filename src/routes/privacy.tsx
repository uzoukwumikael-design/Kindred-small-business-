import { createFileRoute } from "@tanstack/react-router";
import { Privacy } from "@/components/kindling/privacy";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead({ title: "Privacy | Kindling", description: "What happens to what you type: what stays on your device, what is sent to an AI service, and how to delete it.", path: "/privacy" }),
  component: Privacy,
});
