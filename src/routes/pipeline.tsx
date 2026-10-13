import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage } from "@/pages/PipelinePage";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Sales Pipeline | AI Business Builder" },
      { name: "description", content: "Leads, converted customers, deals and revenue in one place, with CSV export." },
      { property: "og:title", content: "Sales Pipeline | AI Business Builder" },
      { property: "og:description", content: "Leads, converted customers, deals and revenue in one place, with CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PipelinePage,
});
