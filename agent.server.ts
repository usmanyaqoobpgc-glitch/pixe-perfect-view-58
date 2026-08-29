import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

type AgentType =
  | "business"
  | "market_research"
  | "competitor"
  | "business_strategy"
  | "marketing"
  | "sales"
  | "analytics"
  | "optimization"
  | "content"
  | "social_media"
  | "email_marketing"
  | "website_seo"
  | "finance"
  | "data_excel"
  | "coding"
  | "design_creative"
  | "document_pdf"
  | "project_task"
  | "web_research";

export const AGENT_REGISTRY: Record<AgentType, { name: string; description: string; taskTypes: string[] }> = {
  business: { name: "Business Agent", description: "Orchestrates the business operating system.", taskTypes: ["planning", "orchestration", "general"] },
  market_research: { name: "Market Research Agent", description: "Researches markets, demand, segments and opportunities.", taskTypes: ["research"] },
  competitor: { name: "Competitor Agent", description: "Analyzes competitors, offers, positioning and pricing.", taskTypes: ["competitor_analysis"] },
  business_strategy: { name: "Business Strategy Agent", description: "Turns business goals into practical strategies.", taskTypes: ["strategy"] },
  marketing: { name: "Marketing Agent", description: "Creates campaigns, funnels and marketing plans.", taskTypes: ["marketing"] },
  sales: { name: "Sales Agent", description: "Improves lead qualification, sales workflows and scripts.", taskTypes: ["sales"] },
  analytics: { name: "Analytics Agent", description: "Analyzes KPIs, revenue and performance.", taskTypes: ["analytics"] },
  optimization: { name: "Optimization Agent", description: "Finds improvements from business performance data.", taskTypes: ["optimization"] },
  content: { name: "Content Agent", description: "Writes blogs, product copy, landing copy and content calendars.", taskTypes: ["content"] },
  social_media: { name: "Social Media Agent", description: "Plans and prepares social content and campaigns.", taskTypes: ["social_media", "publish"] },
  email_marketing: { name: "Email Marketing Agent", description: "Creates email campaigns, sequences and customer messaging.", taskTypes: ["email_marketing", "outreach"] },
  website_seo: { name: "Website & SEO Agent", description: "Audits and improves website structure, SEO and conversion copy.", taskTypes: ["website_seo", "publish"] },
  finance: { name: "Finance Agent", description: "Performs calculations, forecasts, budgets and financial analysis.", taskTypes: ["finance"] },
  data_excel: { name: "Data & Excel Agent", description: "Analyzes business data and produces structured reports.", taskTypes: ["data"] },
  coding: { name: "Coding Agent", description: "Plans, reviews and generates technical work for the business.", taskTypes: ["coding"] },
  design_creative: { name: "Design & Creative Agent", description: "Plans creative assets, brand concepts and campaign visuals.", taskTypes: ["design"] },
  document_pdf: { name: "Document & PDF Agent", description: "Creates proposals, reports and document-ready outputs.", taskTypes: ["document"] },
  project_task: { name: "Project & Task Agent", description: "Turns goals into projects, milestones and executable tasks.", taskTypes: ["project"] },
  web_research: { name: "Web Research Agent", description: "Prepares web research plans and evidence-backed research outputs when a web provider is configured.", taskTypes: ["web_research"] },
};

export const AGENT_CAPABILITIES = [
  "read_business_profile",
  "read_business_plan",
  "read_agent_tasks",
  "write_agent_tasks",
  "write_activity_log",
  "generate_ai_outputs",
] as const;

const APPROVAL_REQUIRED_TASK_TYPES = new Set([
  "external_action", "publish", "outreach", "destructive", "financial_action", "deployment",
]);

function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const banned = /(password|secret|token|api[_-]?key|credential|authorization|session|cookie)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (banned.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (v === null || ["number", "boolean"].includes(typeof v)) out[k] = v;
  }
  return out;
}

async function assertBusinessOwned(supabase: DB, userId: string, businessId: string) {
  const { data, error } = await supabase.from("businesses")
    .select("id, name, idea, budget, country, target_customer, business_model, revenue_target, status")
    .eq("id", businessId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Business not found or you do not have access to it.");
  return data;
}

export async function logActivity(supabase: DB, params: {
  userId: string; businessId: string; agentId: string | null; taskId?: string | null;
  action: string; status?: string; metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("agent_activity_log").insert({
    user_id: params.userId, business_id: params.businessId, agent_id: params.agentId,
    task_id: params.taskId ?? null, action: cleanText(params.action, 120), status: cleanText(params.status ?? "info", 40),
    metadata: sanitizeMetadata(params.metadata ?? {}),
  });
  if (error) console.error("agent_activity_log insert failed", error.message);
}

export async function getOrCreateAgent(supabase: DB, userId: string, businessId: string) {
  const business = await assertBusinessOwned(supabase, userId, businessId);
  const { data: existing } = await supabase.from("business_agents").select("*").eq("business_id", businessId).eq("user_id", userId).maybeSingle();
  if (existing) return { agent: existing, business };
  const { data, error } = await supabase.from("business_agents").insert({
    business_id: businessId, user_id: userId, name: `${business.name} Agent`, status: "active",
    objective: `Help grow ${business.name} toward its revenue target.`,
  }).select().single();
  if (error || !data) throw new Error("Unable to create the agent for this business.");
  await logActivity(supabase, { userId, businessId, agentId: data.id, action: "agent_created", status: "completed" });
  return { agent: data, business };
}

export async function setAgentStatus(supabase: DB, userId: string, agentId: string, status: "active" | "paused") {
  const { data, error } = await supabase.from("business_agents").update({ status })
    .eq("id", agentId).eq("user_id", userId).select().single();
  if (error || !data) throw new Error("Unable to update the agent status.");
  await logActivity(supabase, { userId, businessId: data.business_id, agentId, action: status === "active" ? "agent_resumed" : "agent_paused", status: "completed" });
  return data;
}

export async function setAgentObjective(supabase: DB, userId: string, agentId: string, objective: string) {
  const clean = cleanText(objective, 500);
  if (!clean) throw new Error("Objective cannot be empty.");
  const { data, error } = await supabase.from("business_agents").update({ objective: clean })
    .eq("id", agentId).eq("user_id", userId).select().single();
  if (error || !data) throw new Error("Unable to update the objective.");
  await logActivity(supabase, { userId, businessId: data.business_id, agentId, action: "objective_updated", status: "completed" });
  return data;
}

export async function createTask(supabase: DB, userId: string, input: {
  agentId: string; title: string; description?: string; taskType?: string; priority?: string; result?: Record<string, unknown>; assignedAgentType?: AgentType; executionKey?: string; approvalReason?: string;
}) {
  const { data: agent } = await supabase.from("business_agents").select("id,business_id,user_id,status")
    .eq("id", input.agentId).eq("user_id", userId).maybeSingle();
  if (!agent) throw new Error("Agent not found or you do not have access to it.");
  const taskType = cleanText(input.taskType ?? "general", 80);
  const requiresApproval = APPROVAL_REQUIRED_TASK_TYPES.has(taskType);
  const { data, error } = await supabase.from("agent_tasks").insert({
    agent_id: agent.id, business_id: agent.business_id, user_id: userId,
    title: cleanText(input.title, 200), description: input.description ? cleanText(input.description, 3000) : null,
    task_type: taskType, priority: ["low", "medium", "high", "urgent"].includes(input.priority ?? "") ? input.priority : "medium",
    status: requiresApproval ? "awaiting_approval" : "pending", requires_approval: requiresApproval, approval_reason: requiresApproval ? cleanText(input.approvalReason ?? "This action can affect external systems or business data.", 500) : null, assigned_agent_type: input.assignedAgentType ?? null, execution_key: input.executionKey ?? null, result: input.result ?? {},
  }).select().single();
  if (error || !data) throw new Error(`Unable to create the task: ${error?.message ?? "unknown error"}`);
  await logActivity(supabase, { userId, businessId: agent.business_id, agentId: agent.id, taskId: data.id, action: "task_created", status: data.status, metadata: { task_type: taskType } });
  return data;
}

async function buildBusinessContext(supabase: DB, userId: string, businessId: string) {
  const business = await assertBusinessOwned(supabase, userId, businessId);
  const [{ data: planRows }, { data: recentTasks }, { data: leads }, { data: customers }, { data: revenue }] = await Promise.all([
    supabase.from("business_plans").select("section_key, content").eq("business_id", businessId).limit(25),
    supabase.from("agent_tasks").select("id,title,status,task_type,priority,result").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
    supabase.from("leads").select("status,estimated_value").eq("business_id", businessId).limit(100),
    supabase.from("customers").select("status").eq("business_id", businessId).limit(100),
    supabase.from("revenue_records").select("type,amount,date").eq("business_id", businessId).order("date", { ascending: false }).limit(100),
  ]);
  return {
    business,
    planSections: (planRows ?? []).map((r: any) => ({ key: r.section_key, content: JSON.stringify(r.content).slice(0, 1800) })),
    recentTasks: recentTasks ?? [],
    leadSummary: leads ?? [], customerSummary: customers ?? [], revenueRecords: revenue ?? [],
  };
}

type AIJson = Record<string, unknown>;

async function runAI(prompt: string): Promise<AIJson> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI provider is not configured. Add LOVABLE_API_KEY in the server environment.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [
      { role: "system", content: "You are a secure business operating-system agent. Return strict JSON only. Never claim to have performed external actions. Keep outputs concise and actionable." },
      { role: "user", content: prompt },
    ] }),
  });
  if (!res.ok) throw new Error(`AI provider returned status ${res.status}`);
  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI provider returned an unreadable response.");
  return JSON.parse(match[0]) as AIJson;
}

export async function planObjective(supabase: DB, userId: string, businessId: string, objective: string) {
  const { agent, business } = await getOrCreateAgent(supabase, userId, businessId);
  if (agent.status !== "active") throw new Error("Business Agent is paused.");
  const context = await buildBusinessContext(supabase, userId, businessId);
  const prompt = `Create an execution plan for this business objective: ${cleanText(objective, 1000)}\nBusiness: ${JSON.stringify(context.business)}\nPlan sections: ${JSON.stringify(context.planSections).slice(0,12000)}\nRecent tasks: ${JSON.stringify(context.recentTasks).slice(0,6000)}\nReturn JSON: {"summary":string,"tasks":[{"title":string,"description":string,"agent_type":one of ${Object.keys(AGENT_REGISTRY).join(",")},"priority":"low|medium|high|urgent","requires_approval":boolean,"depends_on":number[]}]}\nCreate 3-10 useful tasks. Only set requires_approval true for external_action/publish/outreach/destructive/financial_action/deployment work.`;
  const plan = await runAI(prompt);
  const rawTasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const tasks = [];
  for (let i = 0; i < Math.min(rawTasks.length, 10); i++) {
    const t = rawTasks[i] as any;
    const agentType = (String(t.agent_type) in AGENT_REGISTRY ? String(t.agent_type) : "project_task") as AgentType;
    const requiresApproval = Boolean(t.requires_approval) || AGENT_REGISTRY[agentType].taskTypes.some((x) => APPROVAL_REQUIRED_TASK_TYPES.has(x));
    const task = await createTask(supabase, userId, {
      agentId: agent.id, title: String(t.title || `${AGENT_REGISTRY[agentType].name} task`),
      assignedAgentType: agentType,
      executionKey: `${businessId}:${cleanText(objective, 200).toLowerCase()}:${i}:${cleanText(String(t.title || "task"), 120).toLowerCase()}`,
      description: `${String(t.description || "").slice(0, 2500)}\n\nAssigned specialist: ${AGENT_REGISTRY[agentType].name}`,
      taskType: requiresApproval ? (AGENT_REGISTRY[agentType].taskTypes[0] === "publish" ? "publish" : "outreach") : (AGENT_REGISTRY[agentType].taskTypes[0] ?? "general"),
      priority: String(t.priority || "medium"), approvalReason: requiresApproval ? "This task may publish, contact external parties, change external systems, deploy, delete data, or perform a financial action." : undefined, result: { agent_type: agentType, dependencies: Array.isArray(t.depends_on) ? t.depends_on.slice(0, 10) : [] },
    });
    tasks.push(task);
  }
  await supabase.from("business_agents").update({ objective: cleanText(objective, 500), last_activity_at: new Date().toISOString(), last_error: null }).eq("id", agent.id).eq("user_id", userId);
  await logActivity(supabase, { userId, businessId, agentId: agent.id, action: "objective_planned", status: "completed", metadata: { task_count: tasks.length, summary: cleanText(plan.summary, 500) } });
  return { agent, business, summary: cleanText(plan.summary, 1000), tasks };
}

export async function runTask(supabase: DB, userId: string, taskId: string) {
  const { data: task } = await supabase.from("agent_tasks").select("*").eq("id", taskId).eq("user_id", userId).maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status === "awaiting_approval") throw new Error("This task needs your approval before it can run.");
  if (["completed", "cancelled"].includes(task.status)) return task;
  const { data: agent } = await supabase.from("business_agents").select("id,business_id,status,objective").eq("id", task.agent_id).eq("user_id", userId).maybeSingle();
  if (!agent) throw new Error("Agent not found.");
  if (agent.status !== "active") throw new Error("The agent is paused. Resume it to run tasks.");
  // Atomic claim: only pending tasks can become running.
  const { data: claimed } = await supabase.from("agent_tasks").update({ status: "running", started_at: new Date().toISOString(), error_message: null }).eq("id", taskId).eq("user_id", userId).eq("status", "pending").select().maybeSingle();
  if (!claimed) throw new Error("Task is already running or has changed state.");
  await logActivity(supabase, { userId, businessId: task.business_id, agentId: agent.id, taskId, action: "task_started", status: "running" });
  try {
    const context = await buildBusinessContext(supabase, userId, task.business_id);
    const assignedType = String((task.result as any)?.agent_type ?? "project_task");
    const specialist = AGENT_REGISTRY[assignedType as AgentType] ?? AGENT_REGISTRY.project_task;
    const prompt = `Execute this internal business task as ${specialist.name}.\nTask: ${task.title}\nDetails: ${task.description ?? ""}\nBusiness context: ${JSON.stringify(context).slice(0, 18000)}\nReturn JSON: {"summary":string,"deliverables":[string],"next_actions":[string],"risks":[string],"requires_external_action":boolean}. Do not claim external actions were performed.`;
    const result = await runAI(prompt);
    const safeResult = { ...result, agent_type: assignedType, generated_at: new Date().toISOString(), provider: "lovable_ai" };

    // Safe internal tools: write AI-created artifacts only inside the authenticated user's business.
    // External sending/publishing is intentionally never performed here.
    if (["content", "marketing", "social_media", "email_marketing"].includes(assignedType)) {
      const deliverables = Array.isArray((result as any).deliverables) ? (result as any).deliverables : [];
      const body = deliverables.map((x: unknown) => String(x).slice(0, 2000)).join("\n\n").slice(0, 8000);
      if (body) {
        const channel = assignedType === "email_marketing" ? "Email" : assignedType === "social_media" ? "Social Media" : "Marketing";
        await supabase.from("marketing_content").insert({
          business_id: task.business_id, channel, content_type: assignedType === "email_marketing" ? "Campaign" : "Draft",
          title: cleanText(task.title, 200), body, status: "drafted",
        });
      }
    }

    if (assignedType === "project_task") {
      await supabase.from("tasks").insert({
        business_id: task.business_id, title: cleanText(task.title, 200),
        description: cleanText(String((result as any).summary ?? task.description ?? ""), 2000),
        category: "AI Agent", priority: task.priority, status: "todo",
      });
    }

    if (assignedType === "website_seo" && !(task.task_type === "publish" || task.requires_approval)) {
      const content = {
        source: "AI Website & SEO Agent", task: task.title,
        recommendations: Array.isArray((result as any).next_actions) ? (result as any).next_actions.slice(0, 20) : [],
        summary: cleanText(String((result as any).summary ?? ""), 4000),
      };
      const { data: latestDraft } = await supabase.from("website_drafts").select("id,version").eq("business_id", task.business_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latestDraft) await supabase.from("website_drafts").update({ content, version: Number(latestDraft.version ?? 1) + 1 }).eq("id", latestDraft.id);
      else await supabase.from("website_drafts").insert({ business_id: task.business_id, content, is_published: false });
    }

    const { data: updated } = await supabase.from("agent_tasks").update({ status: "completed", completed_at: new Date().toISOString(), result: safeResult }).eq("id", taskId).eq("user_id", userId).select().single();
    await supabase.from("business_agents").update({ last_activity_at: new Date().toISOString(), last_error: null }).eq("id", agent.id).eq("user_id", userId);
    await logActivity(supabase, { userId, businessId: task.business_id, agentId: agent.id, taskId, action: "task_completed", status: "completed", metadata: { agent_type: assignedType } });
    return updated;
  } catch (err) {
    const message = cleanText(err instanceof Error ? err.message : "The task failed unexpectedly.", 300);
    await supabase.from("agent_tasks").update({ status: "failed", error_message: message }).eq("id", taskId).eq("user_id", userId);
    await supabase.from("business_agents").update({ last_activity_at: new Date().toISOString(), last_error: message }).eq("id", agent.id).eq("user_id", userId);
    await logActivity(supabase, { userId, businessId: task.business_id, agentId: agent.id, taskId, action: "task_failed", status: "failed", metadata: { reason: message } });
    throw new Error(message);
  }
}

export async function decideApproval(supabase: DB, userId: string, taskId: string, approve: boolean) {
  const { data: task } = await supabase.from("agent_tasks").select("id,business_id,agent_id,status").eq("id", taskId).eq("user_id", userId).maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status !== "awaiting_approval") throw new Error("This task is not awaiting approval.");
  const { data, error } = await supabase.from("agent_tasks").update({ status: approve ? "pending" : "cancelled" }).eq("id", taskId).eq("user_id", userId).eq("status", "awaiting_approval").select().single();
  if (error || !data) throw new Error("Unable to record your decision.");
  await logActivity(supabase, { userId, businessId: task.business_id, agentId: task.agent_id, taskId, action: approve ? "task_approved" : "task_rejected", status: data.status });
  return data;
}

export async function cancelTask(supabase: DB, userId: string, taskId: string) {
  const { data, error } = await supabase.from("agent_tasks").update({ status: "cancelled" }).eq("id", taskId).eq("user_id", userId).in("status", ["pending", "awaiting_approval"]).select().single();
  if (error || !data) throw new Error("Only pending or approval tasks can be cancelled.");
  await logActivity(supabase, { userId, businessId: data.business_id, agentId: data.agent_id, taskId, action: "task_cancelled", status: "cancelled" });
  return data;
}

export async function getDashboard(supabase: DB, userId: string, businessId: string) {
  await assertBusinessOwned(supabase, userId, businessId);
  const { agent } = await getOrCreateAgent(supabase, userId, businessId);
  const [{ data: tasks }, { data: activity }] = await Promise.all([
    supabase.from("agent_tasks").select("*").eq("business_id", businessId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("agent_activity_log").select("*").eq("business_id", businessId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  return { agent, tasks: tasks ?? [], activity: activity ?? [], registry: AGENT_REGISTRY };
}
