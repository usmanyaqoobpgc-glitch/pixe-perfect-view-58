import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/pages/SecurityPage";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security Center | AI Business Builder" },
      { name: "description", content: "Review sessions, MFA and security events." },
      { property: "og:title", content: "Security Center | AI Business Builder" },
      { property: "og:description", content: "Review sessions, MFA and security events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SecurityPage,
});
