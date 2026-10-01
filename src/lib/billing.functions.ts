import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  origin: z.string().url().max(200),
});
const originSchema = z.object({ origin: z.string().url().max(200) });

async function userEmail(context: { supabase: any; userId: string }): Promise<string> {
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user?.email) throw new Error("Could not read your account email.");
  return data.user.email;
}

export const getSubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = await userEmail(context);
    const { syncSubscriptionRow } = await import("./billing.server");
    return syncSubscriptionRow(context.userId, email);
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const email = await userEmail(context);
    const { createCheckoutSession } = await import("./billing.server");
    const url = await createCheckoutSession({ email, plan: data.plan, origin: data.origin });
    return { url };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => originSchema.parse(data))
  .handler(async ({ data, context }) => {
    const email = await userEmail(context);
    const { createPortalSession } = await import("./billing.server");
    const url = await createPortalSession(email, data.origin);
    return { url };
  });

export const getInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = await userEmail(context);
    const { listInvoices } = await import("./billing.server");
    return listInvoices(email);
  });
