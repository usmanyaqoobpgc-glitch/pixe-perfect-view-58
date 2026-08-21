import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/pages/TasksPage";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks | AI Business Builder" },
      { name: "description", content: "Track execution tasks across your businesses." },
      { property: "og:title", content: "Tasks | AI Business Builder" },
      { property: "og:description", content: "Track execution tasks across your businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TasksPage,
});
