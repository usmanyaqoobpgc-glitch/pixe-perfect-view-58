import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/pages/OverviewPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview | AI Business Builder" },
      {
        name: "description",
        content:
          "Your AI business command center: plans, goals, leads, customers and revenue in one dashboard.",
      },
      { property: "og:title", content: "Overview | AI Business Builder" },
      {
        property: "og:description",
        content:
          "Your AI business command center: plans, goals, leads, customers and revenue in one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});
