import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; regenerateSection?: string }) => data)
  .handler(async ({ data, context }) => {
    const { runPlanner } = await import("./ai-planner.server");
    return runPlanner(context.supabase, context.userId, data.businessId, data.regenerateSection);
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteAccount } = await import("./account.server");
    return deleteAccount(context.supabase, context.userId);
  });
