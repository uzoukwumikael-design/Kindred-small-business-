import { createFileRoute } from "@tanstack/react-router";
import { Help } from "@/components/kindling/help";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/help")({
  head: () => pageHead({ title: "Help | Kindling", description: "Answers to the questions people ask first, and how to reach a person.", path: "/help" }),
  component: Help,
});
