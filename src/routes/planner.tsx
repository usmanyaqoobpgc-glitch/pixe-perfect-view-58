import { createFileRoute } from "@tanstack/react-router";
import { PlannerPage } from "@/pages/PlannerPage";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "AI Business Planner | AI Business Builder" },
      { name: "description", content: "Generate a complete business plan with AI." },
      { property: "og:title", content: "AI Business Planner | AI Business Builder" },
      { property: "og:description", content: "Generate a complete business plan with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerPage,
});
