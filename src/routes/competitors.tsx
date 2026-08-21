import { createFileRoute } from "@tanstack/react-router";
import { CompetitorsPage } from "@/pages/CompetitorsPage";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "Competitor Analysis | AI Business Builder" },
      { name: "description", content: "Track and compare your competitors." },
      { property: "og:title", content: "Competitor Analysis | AI Business Builder" },
      { property: "og:description", content: "Track and compare your competitors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompetitorsPage,
});
