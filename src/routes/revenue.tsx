import { createFileRoute } from "@tanstack/react-router";
import { RevenueHistoryPage } from "@/pages/RevenueHistoryPage";

export const Route = createFileRoute("/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue History | AI Business Builder" },
      { name: "description", content: "Monthly income, expenses and deals alongside your leads and customers." },
      { property: "og:title", content: "Revenue History | AI Business Builder" },
      { property: "og:description", content: "Monthly income, expenses and deals alongside your leads and customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevenueHistoryPage,
});
