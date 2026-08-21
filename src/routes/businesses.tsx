import { createFileRoute } from "@tanstack/react-router";
import { BusinessesPage } from "@/pages/BusinessesPage";

export const Route = createFileRoute("/businesses")({
  head: () => ({
    meta: [
      { title: "My Businesses | AI Business Builder" },
      { name: "description", content: "Manage every business you are building in one place." },
      { property: "og:title", content: "My Businesses | AI Business Builder" },
      { property: "og:description", content: "Manage every business you are building in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessesPage,
});
