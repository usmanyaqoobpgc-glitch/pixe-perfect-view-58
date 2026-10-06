import { createFileRoute } from "@tanstack/react-router";

// Public endpoint called by Stripe. Authenticity is enforced by the Stripe signature check inside the handler.
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { handleStripeWebhook } = await import("@/lib/billing.server");
        return handleStripeWebhook(request);
      },
    },
  },
});
