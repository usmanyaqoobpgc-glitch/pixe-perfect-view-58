import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid("Invalid id");

const planObjectiveSchema = z.object({
  businessId: id,
  objective: z.string().trim().min(1, "Please enter an objective.").max(500),
});
const businessSchema = z.object({ businessId: id });
const taskSchema = z.object({ taskId: id });
const approveSchema = z.object({ taskId: id, approve: z.boolean() });
const agentStatusSchema = z.object({ agentId: id, status: z.enum(["active", "paused"]) });
const chatSchema = z.object({
  businessId: id,
  mode: z.enum(["chat", "document"]).default("chat"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .transform((m) => m.slice(-20)),
});

export const planBusinessObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => planObjectiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { planObjective } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyle(context.supabase, data.businessId);
    return b.withBrandStyle(style, () => planObjective(context.supabase, context.userId, data.businessId, data.objective));
  });

export const getAgentDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => businessSchema.parse(data))
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
  .validator((data: unknown) => taskSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { runTask } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyleForTask(context.supabase, data.taskId);
    return b.withBrandStyle(style, () => runTask(context.supabase, context.userId, data.taskId));
  });

export const approveAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => approveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { decideApproval } = await import("./agent.server");
    return decideApproval(context.supabase, context.userId, data.taskId, data.approve);
  });

export const cancelAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => taskSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { cancelTask } = await import("./agent.server");
    return cancelTask(context.supabase, context.userId, data.taskId);
  });

export const setBusinessAgentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => agentStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setAgentStatus } = await import("./agent.server");
    return setAgentStatus(context.supabase, context.userId, data.agentId, data.status);
  });

export const chatWithAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { agentChat } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyle(context.supabase, data.businessId);
    return b.withBrandStyle(style, () => agentChat(context.supabase, context.userId, data.businessId, data.messages, data.mode));
  });
