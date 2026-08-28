import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only AI Business Agent core.
 *
 * All calls receive the request-scoped Supabase client from `requireSupabaseAuth`,
 * so every read/write is executed as the signed-in user and constrained by RLS.
 * The agent never uses the service-role client and never touches auth, roles or MFA.
 */

type DB = SupabaseClient<any, any, any>;

export const AGENT_CAPABILITIES = [
  "read_business_profile",
  "read_business_plan",
  "read_agent_tasks",
  "write_agent_tasks",
  "write_activity_log",
] as const;

/** Task types that may never run without an explicit human approval. */
const APPROVAL_REQUIRED_TASK_TYPES = new Set(["external_action", "publish", "outreach", "destructive"]);

function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const banned = /(password|secret|token|api[_-]?key|credential|authorization|session)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (banned.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (v === null || ["number", "boolean"].includes(typeof v)) out[k] = v;
  }
  return out;
}

async function assertBusinessOwned(supabase: DB, userId: string, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, idea, budget, country, target_customer, business_model, revenue_target, status")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this business.");
  if (!data) throw new Error("Business not found or you do not have access to it.");
  return data;
}

export async function logActivity(
  supabase: DB,
  params: {
    userId: string;
    businessId: string;
    agentId: string | null;
    taskId?: string | null;
    action: string;
    status?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("agent_activity_log").insert({
    user_id: params.userId,
    business_id: params.businessId,
    agent_id: params.agentId,
    task_id: params.taskId ?? null,
    action: params.action,
    status: params.status ?? "info",
    metadata: sanitizeMetadata(params.metadata ?? {}),
  });
}

export async function getOrCreateAgent(supabase: DB, userId: string, businessId: string) {
  const business = await assertBusinessOwned(supabase, userId, businessId);

  const { data: existing } = await supabase
    .from("business_agents")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing) return { agent: existing, business };

  const { data, error } = await supabase
    .from("business_agents")
    .insert({
      business_id: businessId,
      user_id: userId,
      name: `${business.name} Agent`,
      status: "active",
      objective: `Help grow ${business.name} toward its revenue target.`,
    })
    .select()
    .single();
  if (error) throw new Error("Unable to create the agent for this business.");

  await logActivity(supabase, {
    userId,
    businessId,
    agentId: data.id,
    action: "agent_created",
    status: "completed",
  });
  return { agent: data, business };
}

export async function setAgentStatus(supabase: DB, userId: string, agentId: string, status: "active" | "paused") {
  const { data, error } = await supabase
    .from("business_agents")
    .update({ status })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !data) throw new Error("Unable to update the agent status.");
  await logActivity(supabase, {
    userId,
    businessId: data.business_id,
    agentId,
    action: status === "active" ? "agent_resumed" : "agent_paused",
    status: "completed",
  });
  return data;
}

export async function setAgentObjective(supabase: DB, userId: string, agentId: string, objective: string) {
  const clean = objective.trim().slice(0, 500);
  const { data, error } = await supabase
    .from("business_agents")
    .update({ objective: clean })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !data) throw new Error("Unable to update the objective.");
  await logActivity(supabase, {
    userId,
    businessId: data.business_id,
    agentId,
    action: "objective_updated",
    status: "completed",
  });
  return data;
}

export async function createTask(
  supabase: DB,
  userId: string,
  input: { agentId: string; title: string; description?: string; taskType?: string; priority?: string },
) {
  const { data: agent } = await supabase
    .from("business_agents")
    .select("id, business_id, user_id")
    .eq("id", input.agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) throw new Error("Agent not found or you do not have access to it.");

  const taskType = input.taskType ?? "general";
  const requiresApproval = APPROVAL_REQUIRED_TASK_TYPES.has(taskType);

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agent.id,
      business_id: agent.business_id,
      user_id: userId,
      title: input.title.trim().slice(0, 200),
      description: input.description?.trim().slice(0, 2000) ?? null,
      task_type: taskType,
      priority: input.priority ?? "medium",
      status: requiresApproval ? "awaiting_approval" : "pending",
      requires_approval: requiresApproval,
    })
    .select()
    .single();
  if (error || !data) throw new Error("Unable to create the task.");

  await logActivity(supabase, {
    userId,
    businessId: agent.business_id,
    agentId: agent.id,
    taskId: data.id,
    action: "task_created",
    status: data.status,
    metadata: { task_type: taskType },
  });
  return data;
}

/** Read-only business context assembled from data that already exists in the app. */
async function buildBusinessContext(supabase: DB, userId: string, businessId: string) {
  const business = await assertBusinessOwned(supabase, userId, businessId);
  const [{ data: planRows }, { data: recentTasks }] = await Promise.all([
    supabase.from("business_plans").select("section_key, content").eq("business_id", businessId).limit(25),
    supabase
      .from("agent_tasks")
      .select("title, status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    business,
    planSections: (planRows ?? []).map((r: { section_key: string; content: unknown }) => ({
      key: r.section_key,
      content: JSON.stringify(r.content).slice(0, 1200),
    })),
    recentTasks: recentTasks ?? [],
  };
}

type ProviderResult = { summary: string; steps: string[]; provider: "lovable_ai" | "mock" };

/**
 * AI provider abstraction. Uses the server-side Lovable AI gateway when a key is
 * present (read inside the handler, never exposed to the client); otherwise it
 * returns a clearly-labelled deterministic placeholder so the agent stays usable.
 */
async function runProvider(
  task: { title: string; description: string | null; task_type: string },
  context: Awaited<ReturnType<typeof buildBusinessContext>>,
  objective: string | null,
): Promise<ProviderResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const prompt = [
    `Business: ${context.business.name}`,
    `Idea: ${context.business.idea}`,
    `Target customer: ${context.business.target_customer ?? "unspecified"}`,
    `Revenue target: ${context.business.revenue_target}`,
    `Agent objective: ${objective ?? "grow the business"}`,
    `Existing plan sections: ${context.planSections.map((s) => s.key).join(", ") || "none"}`,
    `Task: ${task.title}`,
    task.description ? `Task details: ${task.description}` : "",
    "Respond with JSON: {\"summary\": string, \"steps\": string[]}. Keep the summary under 400 characters and give at most 5 short, concrete steps.",
  ]
    .filter(Boolean)
    .join("\n");

  if (!apiKey) {
    return {
      provider: "mock",
      summary: `Placeholder result for "${task.title}". No AI provider is configured, so the agent produced a structured outline instead of a generated answer.`,
      steps: [
        `Clarify the desired outcome for ${context.business.name}.`,
        "Collect the data needed from the existing business plan.",
        "Draft the deliverable and review it before acting.",
      ],
    };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a business operations agent. You only advise; you never claim to have performed external actions. Reply with strict JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider returned status ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI provider returned an unreadable response.");
  const parsed = JSON.parse(match[0]) as { summary?: string; steps?: unknown };
  return {
    provider: "lovable_ai",
    summary: String(parsed.summary ?? "").slice(0, 1000) || "No summary returned.",
    steps: Array.isArray(parsed.steps) ? parsed.steps.slice(0, 5).map((s) => String(s).slice(0, 300)) : [],
  };
}

export async function runTask(supabase: DB, userId: string, taskId: string) {
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status === "awaiting_approval") throw new Error("This task needs your approval before it can run.");
  if (task.status === "running") throw new Error("This task is already running.");

  const { data: agent } = await supabase
    .from("business_agents")
    .select("id, status, objective")
    .eq("id", task.agent_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) throw new Error("Agent not found.");
  if (agent.status !== "active") throw new Error("The agent is paused. Resume it to run tasks.");

  await supabase.from("agent_tasks").update({ status: "running", error_message: null }).eq("id", taskId);
  await logActivity(supabase, {
    userId,
    businessId: task.business_id,
    agentId: agent.id,
    taskId,
    action: "task_started",
    status: "running",
  });

  try {
    const context = await buildBusinessContext(supabase, userId, task.business_id);
    const result = await runProvider(task, context, agent.objective);
    const { data: updated } = await supabase
      .from("agent_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString(), result })
      .eq("id", taskId)
      .select()
      .single();
    await supabase
      .from("business_agents")
      .update({ last_activity_at: new Date().toISOString(), last_error: null })
      .eq("id", agent.id);
    await logActivity(supabase, {
      userId,
      businessId: task.business_id,
      agentId: agent.id,
      taskId,
      action: "task_completed",
      status: "completed",
      metadata: { provider: result.provider },
    });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "The task failed unexpectedly.";
    const safeMessage = message.slice(0, 300);
    const { data: updated } = await supabase
      .from("agent_tasks")
      .update({ status: "failed", error_message: safeMessage })
      .eq("id", taskId)
      .select()
      .single();
    await supabase
      .from("business_agents")
      .update({ last_activity_at: new Date().toISOString(), last_error: safeMessage })
      .eq("id", agent.id);
    await logActivity(supabase, {
      userId,
      businessId: task.business_id,
      agentId: agent.id,
      taskId,
      action: "task_failed",
      status: "failed",
      metadata: { reason: safeMessage },
    });
    return updated;
  }
}

export async function decideApproval(supabase: DB, userId: string, taskId: string, approve: boolean) {
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("id, business_id, agent_id, status")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status !== "awaiting_approval") throw new Error("This task is not awaiting approval.");

  const { data, error } = await supabase
    .from("agent_tasks")
    .update({ status: approve ? "pending" : "cancelled" })
    .eq("id", taskId)
    .select()
    .single();
  if (error || !data) throw new Error("Unable to record your decision.");

  await logActivity(supabase, {
    userId,
    businessId: task.business_id,
    agentId: task.agent_id,
    taskId,
    action: approve ? "task_approved" : "task_rejected",
    status: data.status,
  });
  return data;
}
