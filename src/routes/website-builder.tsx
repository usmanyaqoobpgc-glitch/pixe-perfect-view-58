import { createFileRoute } from "@tanstack/react-router";
import { WebsiteBuilderPage } from "@/pages/WebsiteBuilderPage";

export const Route = createFileRoute("/website-builder")({
  head: () => ({
    meta: [
      { title: "Website Builder | AI Business Builder" },
      { name: "description", content: "Generate and edit your landing page." },
      { property: "og:title", content: "Website Builder | AI Business Builder" },
      { property: "og:description", content: "Generate and edit your landing page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WebsiteBuilderPage,
});
