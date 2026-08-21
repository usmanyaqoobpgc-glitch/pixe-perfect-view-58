import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | AI Business Builder" },
      { name: "description", content: "Manage your profile and account preferences." },
      { property: "og:title", content: "Settings | AI Business Builder" },
      { property: "og:description", content: "Manage your profile and account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});
