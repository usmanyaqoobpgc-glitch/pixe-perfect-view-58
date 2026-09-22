import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/pages/ApprovalsPage";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Pending Approvals | AI Business Builder" },
      { name: "description", content: "Review and decide on actions your AI agents have flagged for approval." },
      { property: "og:title", content: "Pending Approvals | AI Business Builder" },
      { property: "og:description", content: "Review and decide on actions your AI agents have flagged for approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});
