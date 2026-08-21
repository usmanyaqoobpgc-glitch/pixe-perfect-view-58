import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/pages/MarketingPage";

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing | AI Business Builder" },
      { name: "description", content: "Plan and run marketing campaigns." },
      { property: "og:title", content: "Marketing | AI Business Builder" },
      { property: "og:description", content: "Plan and run marketing campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingPage,
});
