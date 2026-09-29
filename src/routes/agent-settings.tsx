import { createFileRoute } from "@tanstack/react-router";
import { AgentSettingsPage } from "@/pages/AgentSettingsPage";

export const Route = createFileRoute("/agent-settings")({
  head: () => ({
    meta: [
      { title: "Agent Settings | AI Business Builder" },
      { name: "description", content: "Set your AI agent's brand voice, writing style and response length." },
      { property: "og:title", content: "Agent Settings | AI Business Builder" },
      { property: "og:description", content: "Set your AI agent's brand voice, writing style and response length." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentSettingsPage,
});
