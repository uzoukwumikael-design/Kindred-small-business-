import { createFileRoute } from "@tanstack/react-router";
import { Account } from "@/components/kindling/account";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Your account | Kindling" }, { name: "robots", content: "noindex" }],
  }),
  component: Account,
});
