import { createFileRoute } from "@tanstack/react-router";
import { MarketResearchPage } from "@/pages/MarketResearchPage";

export const Route = createFileRoute("/market-research")({
  head: () => ({
    meta: [
      { title: "Market Research | AI Business Builder" },
      { name: "description", content: "Research your market size, trends and audience." },
      { property: "og:title", content: "Market Research | AI Business Builder" },
      { property: "og:description", content: "Research your market size, trends and audience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketResearchPage,
});
