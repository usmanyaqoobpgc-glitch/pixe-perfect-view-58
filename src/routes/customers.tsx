import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/pages/CustomersPage";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers | AI Business Builder" },
      { name: "description", content: "Manage customer relationships and value." },
      { property: "og:title", content: "Customers | AI Business Builder" },
      { property: "og:description", content: "Manage customer relationships and value." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});
