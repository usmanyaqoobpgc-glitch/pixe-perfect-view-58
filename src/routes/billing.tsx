import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/pages/BillingPage";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing | AI Business Builder" },
      { name: "description", content: "Manage your subscription and invoices." },
      { property: "og:title", content: "Billing | AI Business Builder" },
      { property: "og:description", content: "Manage your subscription and invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});
