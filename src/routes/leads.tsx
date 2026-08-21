import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/pages/LeadsPage";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads | AI Business Builder" },
      { name: "description", content: "Capture and qualify inbound leads." },
      { property: "og:title", content: "Leads | AI Business Builder" },
      { property: "og:description", content: "Capture and qualify inbound leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});
