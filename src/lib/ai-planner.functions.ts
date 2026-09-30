import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const generatePlanSchema = z.object({
  businessId: z.string().uuid("Invalid business id"),
  regenerateSection: z.string().trim().min(1).max(60).optional(),
});

export const generateBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => generatePlanSchema.parse(data))
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
