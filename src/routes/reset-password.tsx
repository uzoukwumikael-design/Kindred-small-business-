import { createFileRoute } from "@tanstack/react-router";
import { ResetPassword } from "@/components/kindling/reset-password";
import { pageHead } from "@/lib/kindling/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => pageHead({ title: "Reset your password | Kindling", path: "/reset-password", index: false }),
  component: ResetPassword,
});
