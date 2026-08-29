import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Revenue & Analytics | AI Business Builder" },
      { name: "description", content: "See revenue, growth and performance analytics." },
      { property: "og:title", content: "Revenue & Analytics | AI Business Builder" },
      { property: "og:description", content: "See revenue, growth and performance analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});
