import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const planBusinessObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string; objective: string }) => data)
  .handler(async ({ data, context }) => {
    const { planObjective } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyle(context.supabase, data.businessId);
    return b.withBrandStyle(style, () => planObjective(context.supabase, context.userId, data.businessId, data.objective));
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
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyleForTask(context.supabase, data.taskId);
    return b.withBrandStyle(style, () => runTask(context.supabase, context.userId, data.taskId));
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

export const chatWithAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string; mode: "chat" | "document"; messages: { role: "user" | "assistant"; content: string }[] }) => {
    if (!data?.businessId || !Array.isArray(data.messages) || data.messages.length === 0) throw new Error("Invalid request");
    return { businessId: String(data.businessId), mode: data.mode === "document" ? "document" : "chat", messages: data.messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 8000) })) } as { businessId: string; mode: "chat" | "document"; messages: { role: "user" | "assistant"; content: string }[] };
  })
  .handler(async ({ data, context }) => {
    const { agentChat } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyle(context.supabase, data.businessId);
    return b.withBrandStyle(style, () => agentChat(context.supabase, context.userId, data.businessId, data.messages, data.mode));
  });
