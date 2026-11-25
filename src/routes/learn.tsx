import { createFileRoute } from "@tanstack/react-router";
import { Learn } from "@/components/kindling/learn";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/learn")({
  head: () => pageHead({ title: "Learn | Kindling", description: "Three short lessons on handing the right jobs to AI, checking a draft in 60 seconds, and writing a note it can use.", path: "/learn" }),
  component: Learn,
});
