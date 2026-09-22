import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const planBusinessObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string; objective: string }) => data)
  .handler(async ({ data, context }) => {
    const { planObjective } = await import("./agent.server");
    return planObjective(context.supabase, context.userId, data.businessId, data.objective);
  });

export const getAgentDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getDashboard } = await import("./agent.server");
    return getDashboard(context.supabase, context.userId, data.businessId);
  });

export const getPendingApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listPendingApprovals } = await import("./agent.server");
    return listPendingApprovals(context.supabase, context.userId);
  });

export const executeAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data, context }) => {
    const { runTask } = await import("./agent.server");
    return runTask(context.supabase, context.userId, data.taskId);
  });

export const approveAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { taskId: string; approve: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { decideApproval } = await import("./agent.server");
    return decideApproval(context.supabase, context.userId, data.taskId, data.approve);
  });

export const cancelAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data, context }) => {
    const { cancelTask } = await import("./agent.server");
    return cancelTask(context.supabase, context.userId, data.taskId);
  });

export const setBusinessAgentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { agentId: string; status: "active" | "paused" }) => data)
  .handler(async ({ data, context }) => {
    const { setAgentStatus } = await import("./agent.server");
    return setAgentStatus(context.supabase, context.userId, data.agentId, data.status);
  });
