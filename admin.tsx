import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/pages/AdminPage";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel | AI Business Builder" },
      { name: "description", content: "Administrative tools and user management." },
      { property: "og:title", content: "Admin Panel | AI Business Builder" },
      { property: "og:description", content: "Administrative tools and user management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
