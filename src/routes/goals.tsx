import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/pages/GoalsPage";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Business Goals | AI Business Builder" },
      { name: "description", content: "Set and track measurable goals for each business." },
      { property: "og:title", content: "Business Goals | AI Business Builder" },
      { property: "og:description", content: "Set and track measurable goals for each business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});
