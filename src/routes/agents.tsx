import { createFileRoute } from "@tanstack/react-router";
import { AgentsPage } from "@/pages/AgentsPage";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "AI Agents | AI Business Builder" },
      { name: "description", content: "Configure AI agents that work on your business." },
      { property: "og:title", content: "AI Agents | AI Business Builder" },
      { property: "og:description", content: "Configure AI agents that work on your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});
