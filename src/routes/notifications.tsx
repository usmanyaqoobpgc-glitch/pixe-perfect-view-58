import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/pages/NotificationsPage";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | AI Business Builder" },
      { name: "description", content: "Stay on top of alerts and updates." },
      { property: "og:title", content: "Notifications | AI Business Builder" },
      { property: "og:description", content: "Stay on top of alerts and updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});
