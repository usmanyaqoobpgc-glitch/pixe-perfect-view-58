import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import { chatJSON as callAiProvider, isAiConfigured, activeProviderName, type ChatMessage, type AiProviderName } from "./ai-provider.server";

/**
 * Server-only AI Business Agent core (orchestrator + specialist execution).
 *
 * All calls receive the request-scoped Supabase client from `requireSupabaseAuth`,
 * so every read/write is executed as the signed-in user and constrained by RLS.
 * The agent never uses the service-role client and never touches auth, roles or MFA.
 *
 * AI calls go through ./ai-provider.server, which prefers GEMINI_API_KEY and
 * falls back to the Lovable AI gateway (LOVABLE_API_KEY) if Gemini isn't configured.
 */

type DB = SupabaseClient<any, any, any>;

export const AGENT_CAPABILITIES = [
  "read_business_profile",
  "read_business_plan",
  "read_leads_customers",
  "read_revenue_milestones_tasks",
  "read_agent_tasks",
  "write_agent_tasks",
  "write_agent_runs",
  "write_activity_log",
] as const;

/** Task types that may never run without an explicit human approval. */
const APPROVAL_REQUIRED_TASK_TYPES = new Set(["external_action", "publish", "outreach", "destructive"]);

/** Step wording that implies an external / irreversible action → needs approval. */
const EXTERNAL_ACTION_PATTERN =
  /\b(send|publish|post to|launch|purchase|buy|spend|pay|charge|delete|email blast|cold email|dm |message customers|contact leads)\b/i;

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

// ---------------------------------------------------------------------------
// Specialist agent registry (18 specialists shown in the UI)
// ---------------------------------------------------------------------------

export type SpecialistType =
  | "market_research"
  | "competitor"
  | "business_strategy"
  | "marketing"
  | "sales"
  | "analytics"
  | "optimization"
  | "content_writing"
  | "seo"
  | "social_media"
  | "coding"
  | "finance"
  | "hr_recruitment"
  | "customer_support"
  | "design"
  | "data_excel"
  | "project_management"
  | "education";

interface Specialist {
  name: string;
  role: string;
  planSections: string[];
}

export const SPECIALISTS: Record<SpecialistType, Specialist> = {
  market_research: {
    name: "Market Research Agent",
    role: "You research and summarize market opportunities, demand signals, customer segments and trends for the business.",
    planSections: ["idea_analysis", "target_audience", "market_positioning"],
  },
  competitor: {
    name: "Competitor Agent",
    role: "You identify competitors and compare pricing, features, positioning, strengths and weaknesses, then recommend a differentiation angle.",
    planSections: ["competitor_research", "market_positioning", "pricing_strategy"],
  },
  business_strategy: {
    name: "Business Strategy Agent",
    role: "You create practical, budget-aware business strategies with clear priorities, sequencing and success metrics.",
    planSections: ["roadmap", "offer_creation", "pricing_strategy", "milestones"],
  },
  marketing: {
    name: "Marketing Agent",
    role: "You produce marketing plans, campaign ideas, channel strategies, messaging and content calendars. You never claim to have published anything.",
    planSections: ["marketing_strategy", "target_audience", "brand_names", "offer_creation"],
  },
  sales: {
    name: "Sales Agent",
    role: "You design sales processes, lead qualification criteria, outreach sequences and customer communication templates. You never send messages yourself.",
    planSections: ["offer_creation", "pricing_strategy", "target_audience"],
  },
  analytics: {
    name: "Analytics Agent",
    role: "You analyze the business metrics provided (revenue, leads, customers) and recommend measurable actions. Be explicit when data is missing.",
    planSections: ["revenue_targets"],
  },
  optimization: {
    name: "Optimization Agent",
    role: "You compare goals versus actual progress (milestones, tasks, revenue) and suggest concrete adjustments to get back on track.",
    planSections: ["milestones", "roadmap", "revenue_targets"],
  },
  content_writing: {
    name: "Content Writing Agent",
    role: "You write clear, on-brand written content — blog posts, product copy, landing page copy, scripts and long-form drafts. You never claim to have published anything; you only produce drafts for the founder to review.",
    planSections: ["social_content", "landing_page", "brand_names"],
  },
  seo: {
    name: "SEO Agent",
    role: "You produce keyword research, on-page SEO recommendations, content structure, meta descriptions and technical SEO checklists. You never claim to have made live changes to a website.",
    planSections: ["landing_page", "market_positioning", "kpis"],
  },
  social_media: {
    name: "Social Media Agent",
    role: "You draft social media post ideas, captions, hashtag sets and content calendars for platforms like Instagram, TikTok, YouTube, Facebook and X. You never claim to have posted, scheduled or published anything — you only produce drafts.",
    planSections: ["social_content", "marketing_strategy", "target_audience"],
  },
  coding: {
    name: "Coding Agent",
    role: "You produce technical specifications, code snippets, architecture notes and step-by-step implementation plans for software, websites and apps. You never execute code, access servers, or deploy anything — you only produce drafts and plans for a developer or the founder to run.",
    planSections: ["roadmap"],
  },
  finance: {
    name: "Finance Agent",
    role: "You produce budgets, cash-flow projections, pricing math, unit economics and financial summaries based on the numbers provided. You are explicit about assumptions and never claim to move money, place trades or make payments — you only advise and calculate.",
    planSections: ["pricing_strategy", "revenue_targets", "kpis"],
  },
  hr_recruitment: {
    name: "HR & Recruitment Agent",
    role: "You draft job descriptions, interview questions, hiring plans, onboarding checklists and basic HR policy outlines. You never claim to have contacted candidates or made an offer.",
    planSections: ["roadmap"],
  },
  customer_support: {
    name: "Customer Support Agent",
    role: "You draft support reply templates, FAQ content, escalation guidelines and customer communication scripts. You never claim to have sent a message to a real customer.",
    planSections: ["customer_templates", "target_audience"],
  },
  design: {
    name: "Design Agent",
    role: "You produce design briefs, layout descriptions, color/typography direction, and structured design specifications for landing pages, brand identity and UI screens. You never generate or claim to have produced final image/video files — you produce written creative direction.",
    planSections: ["landing_page", "brand_names"],
  },
  data_excel: {
    name: "Data & Excel Agent",
    role: "You design spreadsheet structures, formulas, reporting layouts and data models based on the business's real numbers (revenue, leads, customers). You never claim to have created or modified an actual file — you describe exactly what to build.",
    planSections: ["kpis", "revenue_targets"],
  },
  project_management: {
    name: "Project Management Agent",
    role: "You break objectives into concrete project plans: milestones, task breakdowns, sequencing, dependencies and owners. You never claim to have assigned real people or sent real notifications.",
    planSections: ["roadmap", "milestones", "daily_tasks"],
  },
  education: {
    name: "Education & Learning Agent",
    role: "You design curricula, course outlines, lesson plans, learning objectives and assessment ideas — useful for training programs, onboarding, or education-focused businesses (schools, colleges, universities, course creators). You never claim to have enrolled or graded a real student.",
    planSections: ["roadmap"],
  },
};

const SPECIALIST_TYPES = Object.keys(SPECIALISTS) as SpecialistType[];

function isSpecialistType(value: unknown): value is SpecialistType {
  return typeof value === "string" && (SPECIALIST_TYPES as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Turns gateway / internal failures into short, safe user-facing messages. */
function userSafeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/status 402|AI credits/i.test(message)) return "AI credits are exhausted. Add credits to your workspace and retry.";
  if (/status 429.*quota|RESOURCE_EXHAUSTED/i.test(message)) return "The Gemini free-tier quota was hit. Wait a bit and retry, or check your Google AI Studio quota.";
  if (/API_KEY_INVALID|status 400.*key|status 401/i.test(message)) return "The configured AI API key was rejected. Check the key and retry.";
  if (/status 429|rate limit/i.test(message)) return "The AI service is rate-limited right now. Please retry in a moment.";
  if (/status 403/i.test(message)) return "AI access is blocked by workspace policy.";
  if (/status 5\d\d/i.test(message)) return "The AI service had a temporary problem. Please retry.";
  return message.slice(0, 300) || "The task failed unexpectedly.";
}

async function assertBusinessOwned(supabase: DB, userId: string, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, idea, budget, country, target_customer, business_model, revenue_target, target_deadline, marketing_channels, skills, status",
    )
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

// ---------------------------------------------------------------------------
// Agent lifecycle
// ---------------------------------------------------------------------------

export async function getOrCreateAgent(supabase: DB, userId: string, businessId: string) {
  const business = await assertBusinessOwned(supabase, userId, businessId);

  const { data: existing } = await supabase
    .from("business_agents")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { agent: existing, business };

  const { data, error } = await supabase
    .from("business_agents")
    .insert({
      business_id: businessId,
      user_id: userId,
      name: `${business.name.replace(/\.\.\.$/, "").slice(0, 60)} Agent`,
      status: "active",
      objective: `Help grow ${business.name.replace(/\.\.\.$/, "").slice(0, 60)} toward its revenue target.`,
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

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(supabase: DB, userId: string, businessId: string) {
  const { agent, business } = await getOrCreateAgent(supabase, userId, businessId);

  const [{ data: tasks }, { data: activity }, { data: runs }] = await Promise.all([
    supabase
      .from("agent_tasks")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("agent_activity_log")
      .select("id, action, status, task_id, metadata, created_at")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("ai_agent_runs").select("agent_type").eq("business_id", businessId).eq("user_id", userId).limit(500),
  ]);

  const counts = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0, awaiting_approval: 0 } as Record<
    string,
    number
  >;
  for (const t of tasks ?? []) counts[t.status] = (counts[t.status] ?? 0) + 1;

  const specialistRuns: Record<string, number> = {};
  for (const r of runs ?? []) specialistRuns[r.agent_type] = (specialistRuns[r.agent_type] ?? 0) + 1;

  return {
    agent,
    business: { id: business.id, name: business.name },
    tasks: tasks ?? [],
    activity: activity ?? [],
    counts,
    specialistRuns,
    aiConfigured: isAiConfigured(),
  };
}

// ---------------------------------------------------------------------------
// Task creation / approval / cancellation
// ---------------------------------------------------------------------------

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

export async function decideApproval(supabase: DB, userId: string, taskId: string, approve: boolean) {
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("id, business_id, agent_id, status, parent_task_id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status !== "awaiting_approval") throw new Error("This task is not awaiting approval.");

  const { data, error } = await supabase
    .from("agent_tasks")
    .update({ status: approve ? "pending" : "cancelled" })
    .eq("id", taskId)
    .eq("status", "awaiting_approval")
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
  if (!approve && task.parent_task_id) await finalizeParentIfDone(supabase, userId, task.parent_task_id);
  return data;
}

export async function cancelTask(supabase: DB, userId: string, taskId: string) {
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("id, business_id, agent_id, status, parent_task_id, task_type")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!task) throw new Error("Task not found or you do not have access to it.");
  if (task.status === "running") throw new Error("A running task cannot be cancelled. Wait for it to finish.");
  if (TERMINAL_STATUSES.has(task.status)) throw new Error("This task is already finished.");

  const { data, error } = await supabase
    .from("agent_tasks")
    .update({ status: "cancelled" })
    .eq("id", taskId)
    .in("status", ["pending", "awaiting_approval"])
    .select()
    .single();
  if (error || !data) throw new Error("Unable to cancel the task.");

  if (task.task_type === "objective") {
    await supabase
      .from("agent_tasks")
      .update({ status: "cancelled" })
      .eq("parent_task_id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "awaiting_approval"]);
  }

  await logActivity(supabase, {
    userId,
    businessId: task.business_id,
    agentId: task.agent_id,
    taskId,
    action: "task_cancelled",
    status: "cancelled",
  });
  if (task.parent_task_id) await finalizeParentIfDone(supabase, userId, task.parent_task_id);
  return data;
}

// ---------------------------------------------------------------------------
// Business context (read-only, reuses existing app data)
// ---------------------------------------------------------------------------

type BusinessRow = Awaited<ReturnType<typeof assertBusinessOwned>>;

function describeBusiness(b: BusinessRow): string {
  return [
    `Business: ${b.name}`,
    `Idea: ${b.idea}`,
    `Business model: ${b.business_model ?? "unspecified"}`,
    `Target customer: ${b.target_customer ?? "unspecified"}`,
    `Country: ${b.country ?? "unspecified"}`,
    `Budget: $${b.budget}`,
    `Revenue target: $${b.revenue_target}${b.target_deadline ? ` by ${b.target_deadline}` : ""}`,
    `Marketing channels: ${(b.marketing_channels ?? []).join(", ") || "unspecified"}`,
    `Founder skills: ${(b.skills ?? []).join(", ") || "unspecified"}`,
  ].join("\n");
}

async function loadPlanSections(supabase: DB, businessId: string, keys: string[]) {
  if (keys.length === 0) return "";
  const { data } = await supabase
    .from("business_plans")
    .select("section_key, content")
    .eq("business_id", businessId)
    .in("section_key", keys)
    .limit(keys.length);
  return (data ?? [])
    .map((r: { section_key: string; content: unknown }) => `## ${r.section_key}\n${JSON.stringify(r.content).slice(0, 1500)}`)
    .join("\n\n");
}

/** Extra, scoped data for specialists that need operational numbers. */
async function loadOperationalContext(supabase: DB, businessId: string, type: SpecialistType): Promise<string> {
  const parts: string[] = [];
  if (type === "sales" || type === "analytics" || type === "customer_support") {
    const [{ data: leads }, { data: customers }] = await Promise.all([
      supabase.from("leads").select("name, status, source, estimated_value").eq("business_id", businessId).limit(15),
      supabase.from("customers").select("name, status, lifetime_value").eq("business_id", businessId).limit(15),
    ]);
    parts.push(`Leads (${leads?.length ?? 0}): ${JSON.stringify(leads ?? []).slice(0, 1200)}`);
    parts.push(`Customers (${customers?.length ?? 0}): ${JSON.stringify(customers ?? []).slice(0, 1200)}`);
  }
  if (type === "analytics" || type === "optimization" || type === "finance" || type === "data_excel") {
    const { data: revenue } = await supabase
      .from("revenue_records")
      .select("type, amount, record_date, is_estimate")
      .eq("business_id", businessId)
      .order("record_date", { ascending: false })
      .limit(30);
    parts.push(`Revenue records: ${JSON.stringify(revenue ?? []).slice(0, 1200)}`);
  }
  if (type === "optimization" || type === "project_management") {
    const [{ data: milestones }, { data: tasks }] = await Promise.all([
      supabase.from("milestones").select("title, status, target_day, due_date").eq("business_id", businessId).limit(20),
      supabase.from("tasks").select("title, status, priority, due_date").eq("business_id", businessId).limit(20),
    ]);
    parts.push(`Milestones: ${JSON.stringify(milestones ?? []).slice(0, 1200)}`);
    parts.push(`Tasks: ${JSON.stringify(tasks ?? []).slice(0, 1200)}`);
  }
  if (type === "marketing" || type === "social_media" || type === "content_writing" || type === "seo") {
    const { data: content } = await supabase
      .from("marketing_content")
      .select("channel, content_type, title, status")
      .eq("business_id", businessId)
      .limit(10);
    parts.push(`Existing marketing content: ${JSON.stringify(content ?? []).slice(0, 800)}`);
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Orchestrator: objective → plan → specialist tasks
// ---------------------------------------------------------------------------

interface PlannedStep {
  agent_type: SpecialistType;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  requires_approval: boolean;
  approval_reason: string | null;
}

interface ObjectivePlan {
  analysis: string;
  plan_summary: string;
  steps: PlannedStep[];
}

function coercePlan(raw: unknown): ObjectivePlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const steps: PlannedStep[] = [];
  for (const s of Array.isArray(r["steps"]) ? r["steps"] : []) {
    if (typeof s !== "object" || s === null) continue;
    const o = s as Record<string, unknown>;
    if (!isSpecialistType(o["agent_type"])) continue;
    const title = String(o["title"] ?? "").trim().slice(0, 200);
    if (!title) continue;
    const priority = ["low", "medium", "high", "urgent"].includes(String(o["priority"]))
      ? (String(o["priority"]) as PlannedStep["priority"])
      : "medium";
    const flagged = o["requires_approval"] === true || EXTERNAL_ACTION_PATTERN.test(title);
    steps.push({
      agent_type: o["agent_type"],
      title,
      description: String(o["description"] ?? "").trim().slice(0, 2000),
      priority,
      requires_approval: flagged,
      approval_reason: flagged
        ? String(o["approval_reason"] ?? "This step implies an external or irreversible action.").slice(0, 300)
        : null,
    });
    if (steps.length >= 8) break;
  }
  return {
    analysis: String(r["analysis"] ?? "").slice(0, 1500),
    plan_summary: String(r["plan_summary"] ?? "").slice(0, 1000),
    steps,
  };
}

function fallbackPlan(objective: string): ObjectivePlan {
  const lower = objective.toLowerCase();
  const steps: PlannedStep[] = [];
  const push = (agent_type: SpecialistType, title: string, description: string) =>
    steps.push({ agent_type, title, description, priority: "medium", requires_approval: false, approval_reason: null });

  if (/market|customer|audience|demand/.test(lower)) push("market_research", "Research the target market", objective);
  if (/competit/.test(lower)) push("competitor", "Analyze competitors", objective);
  if (/market(ing)?|campaign|brand|launch/.test(lower)) push("marketing", "Draft the marketing plan", objective);
  if (/sales|lead|outreach|pipeline/.test(lower)) push("sales", "Design the sales approach", objective);
  if (/revenue|metric|analytic|profit|\bkpi/.test(lower)) push("analytics", "Analyze current metrics", objective);
  if (/blog|article|copy|write|content(?! calendar)/.test(lower)) push("content_writing", "Draft the requested content", objective);
  if (/seo|keyword|search ranking|google ranking/.test(lower)) push("seo", "Produce SEO recommendations", objective);
  if (/social media|instagram|tiktok|facebook|youtube|twitter|\bx\.com\b|post(s)?\b/.test(lower)) push("social_media", "Draft the social media content", objective);
  if (/code|app|website|software|api|database|build (a|an|my) (app|website|site)/.test(lower)) push("coding", "Produce a technical implementation plan", objective);
  if (/budget|cash flow|financ|pricing|unit economics|forecast/.test(lower)) push("finance", "Produce the financial breakdown", objective);
  if (/hire|hiring|recruit|job description|onboard(ing)? (a|new) (employee|hire)/.test(lower)) push("hr_recruitment", "Draft the hiring plan", objective);
  if (/support ticket|customer (service|support)|faq|complaint/.test(lower)) push("customer_support", "Draft support content", objective);
  if (/design|logo|color palette|layout|ui\b|ux\b|brand identity/.test(lower)) push("design", "Produce the design brief", objective);
  if (/spreadsheet|excel|data model|dashboard|report(ing)?/.test(lower)) push("data_excel", "Design the data/reporting structure", objective);
  if (/project plan|milestone|task breakdown|roadmap|sprint/.test(lower)) push("project_management", "Build the project plan", objective);
  if (/course|curriculum|lesson|training program|school|college|university|student/.test(lower)) push("education", "Design the learning plan", objective);
  if (steps.length === 0) push("business_strategy", "Build a strategy for this objective", objective);
  return {
    analysis: "AI planning was unavailable, so the Business Agent used a rule-based routing fallback.",
    plan_summary: `Route "${objective}" to ${steps.slice(0, 8).map((s) => SPECIALISTS[s.agent_type].name).join(", ")}.`,
    steps: steps.slice(0, 8),
  };
}

async function analyzeObjective(business: BusinessRow, planKeys: string, objective: string, recentTasks: string) {
  if (!aiConfigured()) return { plan: fallbackPlan(objective), provider: "mock" as const };
  const providerUsed = activeProviderName();
  const specialistList = SPECIALIST_TYPES.map((t) => `- ${t}: ${SPECIALISTS[t].role}`).join("\n");
  const raw = await chatJSON<unknown>([
    {
      role: "system",
      content: `You are the Business Agent, an orchestrator that turns a founder's objective into an execution plan and delegates each step to exactly one specialist agent.
Available specialist agents (agent_type → role):
${specialistList}

Rules:
- Produce 2 to 8 steps, ordered so that research/analysis comes before strategy and content. Use only as many steps as the objective genuinely needs — do not pad.
- Each step must be a concrete deliverable a specialist can produce as a written document. Specialists only advise and draft; they never send, publish, buy or delete anything.
- Set requires_approval=true only when a step implies an external or irreversible action (sending emails, publishing, spending money) and explain why in approval_reason.
- Respond with strict JSON: {"analysis": string, "plan_summary": string, "steps": [{"agent_type": string, "title": string, "description": string, "priority": "low"|"medium"|"high"|"urgent", "requires_approval": boolean, "approval_reason": string|null}]}`,
    },
    {
      role: "user",
      content: `${describeBusiness(business)}\n\nExisting plan sections available: ${planKeys || "none"}\nRecent agent tasks: ${recentTasks || "none"}\n\nObjective: ${objective}`,
    },
  ]);
  const plan = coercePlan(raw);
  if (plan.steps.length === 0) return { plan: fallbackPlan(objective), provider: providerUsed };
  return { plan, provider: providerUsed };
}

function aiConfigured(): boolean {
  return isAiConfigured();
}

/** Calls the configured AI provider (Gemini preferred, Lovable gateway fallback) and returns parsed JSON. */
async function chatJSON<T>(messages: ChatMessage[]): Promise<T> {
  const { data } = await callAiProvider<T>(messages);
  return data;
}

export async function planObjective(supabase: DB, userId: string, businessId: string, objectiveInput: string) {
  const objective = objectiveInput.trim().slice(0, 500);
  if (objective.length < 8) throw new Error("Please describe the objective in a bit more detail.");

  const { agent, business } = await getOrCreateAgent(supabase, userId, businessId);
  if (agent.status !== "active") throw new Error("The agent is paused. Resume it to run objectives.");

  const { data: inFlight } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("task_type", "objective")
    .eq("title", objective)
    .in("status", ["pending", "running", "awaiting_approval"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inFlight) {
    const { data: children } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("parent_task_id", inFlight.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    return { objective: inFlight, steps: children ?? [], deduplicated: true };
  }

  const hash = createHash("sha256").update(`${businessId}:${objective.toLowerCase()}`).digest("hex").slice(0, 24);
  const executionKey = `${hash}:${Date.now()}`;

  const { data: parent, error: parentError } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agent.id,
      business_id: businessId,
      user_id: userId,
      title: objective,
      description: "Objective handled by the Business Agent.",
      task_type: "objective",
      assigned_agent_type: "business",
      priority: "high",
      status: "running",
      started_at: new Date().toISOString(),
      requires_approval: false,
      execution_key: executionKey,
    })
    .select()
    .single();
  if (parentError || !parent) throw new Error("Unable to start this objective.");

  await logActivity(supabase, {
    userId,
    businessId,
    agentId: agent.id,
    taskId: parent.id,
    action: "objective_received",
    status: "running",
  });

  try {
    const [{ data: planRows }, { data: recent }] = await Promise.all([
      supabase.from("business_plans").select("section_key").eq("business_id", businessId).limit(25),
      supabase
        .from("agent_tasks")
        .select("title, status")
        .eq("business_id", businessId)
        .eq("task_type", "specialist")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    const planKeys = (planRows ?? []).map((r: { section_key: string }) => r.section_key).join(", ");
    const recentTasks = (recent ?? []).map((t: { title: string; status: string }) => `${t.title} (${t.status})`).join("; ");

    const { plan, provider } = await analyzeObjective(business, planKeys, objective, recentTasks);

    const { data: steps, error: stepError } = await supabase
      .from("agent_tasks")
      .insert(
        plan.steps.map((s, i) => ({
          agent_id: agent.id,
          business_id: businessId,
          user_id: userId,
          parent_task_id: parent.id,
          title: s.title,
          description: s.description || null,
          task_type: "specialist",
          assigned_agent_type: s.agent_type,
          priority: s.priority,
          status: s.requires_approval ? "awaiting_approval" : "pending",
          requires_approval: s.requires_approval,
          approval_reason: s.approval_reason,
          execution_key: `${executionKey}:${i + 1}`,
        })),
      )
      .select();
    if (stepError || !steps) throw new Error("Unable to create the execution plan tasks.");

    const { data: updatedParent } = await supabase
      .from("agent_tasks")
      .update({
        result: {
          analysis: plan.analysis,
          plan_summary: plan.plan_summary,
          provider,
          step_count: steps.length,
          agents: steps.map((s: { assigned_agent_type: string }) => s.assigned_agent_type),
        },
      })
      .eq("id", parent.id)
      .select()
      .single();

    await supabase
      .from("business_agents")
      .update({ objective, last_activity_at: new Date().toISOString(), last_error: null })
      .eq("id", agent.id);

    await logActivity(supabase, {
      userId,
      businessId,
      agentId: agent.id,
      taskId: parent.id,
      action: "plan_created",
      status: "completed",
      metadata: { steps: steps.length, provider, awaiting_approval: steps.filter((s: { requires_approval: boolean }) => s.requires_approval).length },
    });
    for (const s of steps) {
      await logActivity(supabase, {
        userId,
        businessId,
        agentId: agent.id,
        taskId: s.id,
        action: "task_created",
        status: s.status,
        metadata: { agent_type: s.assigned_agent_type },
      });
    }

    return { objective: updatedParent ?? parent, steps, deduplicated: false };
  } catch (err) {
    const safe = userSafeError(err);
    await supabase.from("agent_tasks").update({ status: "failed", error_message: safe }).eq("id", parent.id);
    await supabase.from("business_agents").update({ last_error: safe, last_activity_at: new Date().toISOString() }).eq("id", agent.id);
    await logActivity(supabase, {
      userId,
      businessId,
      agentId: agent.id,
      taskId: parent.id,
      action: "objective_failed",
      status: "failed",
      metadata: { reason: safe },
    });
    throw new Error(safe);
  }
}

// ---------------------------------------------------------------------------
// Specialist execution
// ---------------------------------------------------------------------------

interface SpecialistResult {
  summary: string;
  deliverable: string;
  key_points: string[];
  next_actions: string[];
  provider: AiProviderName;
  agent_type: SpecialistType;
  run_id: string | null;
}

async function runSpecialist(
  supabase: DB,
  userId: string,
  business: BusinessRow,
  task: { id: string; title: string; description: string | null; parent_task_id: string | null },
  type: SpecialistType,
  objectiveTitle: string | null,
): Promise<SpecialistResult> {
  const spec = SPECIALISTS[type];
  const [planContext, opsContext] = await Promise.all([
    loadPlanSections(supabase, business.id, spec.planSections),
    loadOperationalContext(supabase, business.id, type),
  ]);

  let output: Omit<SpecialistResult, "provider" | "agent_type" | "run_id">;
  let provider: SpecialistResult["provider"];

  if (!aiConfigured()) {
    provider = "mock";
    output = {
      summary: `Placeholder result from the ${spec.name}. No AI provider is configured, so a structured outline was produced instead of a generated deliverable.`,
      deliverable: `# ${task.title}\n\n1. Clarify the desired outcome for ${business.name}.\n2. Gather the relevant data from the existing business plan.\n3. Draft the deliverable and review it before acting.`,
      key_points: ["AI provider not configured", "Outline only"],
      next_actions: ["Configure the server-side AI provider to get real results."],
    };
  } else {
    provider = activeProviderName();
    const raw = await chatJSON<Record<string, unknown>>([
      {
        role: "system",
        content: `You are the ${spec.name} inside a business operating system. ${spec.role}
You only advise and draft documents. Never claim to have performed external actions. Never ask for or mention credentials.
Respond with strict JSON: {"summary": string (max 400 chars), "deliverable": string (well-structured markdown, 300-900 words), "key_points": string[] (3-6 items), "next_actions": string[] (2-5 concrete items the founder can do)}`,
      },
      {
        role: "user",
        content: [
          describeBusiness(business),
          objectiveTitle ? `\nOverall objective: ${objectiveTitle}` : "",
          `\nYour assigned task: ${task.title}`,
          task.description ? `Task details: ${task.description}` : "",
          planContext ? `\nRelevant business plan context:\n${planContext}` : "",
          opsContext ? `\nOperational data:\n${opsContext}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ]);
    output = {
      summary: String(raw["summary"] ?? "").slice(0, 1000) || "No summary returned.",
      deliverable: String(raw["deliverable"] ?? "").slice(0, 12000),
      key_points: Array.isArray(raw["key_points"]) ? raw["key_points"].slice(0, 8).map((s) => String(s).slice(0, 300)) : [],
      next_actions: Array.isArray(raw["next_actions"]) ? raw["next_actions"].slice(0, 6).map((s) => String(s).slice(0, 300)) : [],
    };
  }

  const { data: run } = await supabase
    .from("ai_agent_runs")
    .insert({
      business_id: business.id,
      user_id: userId,
      agent_type: type,
      status: "completed",
      input: { task_id: task.id, title: task.title, objective: objectiveTitle },
      output,
      reasoning: output.summary,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  return { ...output, provider, agent_type: type, run_id: run?.id ?? null };
}

async function finalizeParentIfDone(supabase: DB, userId: string, parentId: string) {
  const { data: parent } = await supabase
    .from("agent_tasks")
    .select("id, business_id, agent_id, status, result")
    .eq("id", parentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!parent || TERMINAL_STATUSES.has(parent.status)) return;

  const { data: children } = await supabase
    .from("agent_tasks")
    .select("id, title, status, assigned_agent_type, result, error_message")
    .eq("parent_task_id", parentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const list = children ?? [];
  if (list.some((c: { status: string }) => !TERMINAL_STATUSES.has(c.status))) return;

  const completed = list.filter((c: { status: string }) => c.status === "completed");
  const failed = list.filter((c: { status: string }) => c.status === "failed");
  const status = completed.length > 0 ? "completed" : "failed";
  const prior = (parent.result ?? {}) as Record<string, unknown>;

  await supabase
    .from("agent_tasks")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: status === "failed" ? "All planned steps failed or were cancelled." : null,
      result: {
        ...prior,
        completed_steps: completed.length,
        failed_steps: failed.length,
        cancelled_steps: list.length - completed.length - failed.length,
        deliverables: completed.map((c: { id: string; title: string; assigned_agent_type: string; result: Record<string, unknown> }) => ({
          task_id: c.id,
          title: c.title,
          agent_type: c.assigned_agent_type,
          summary: String(c.result?.["summary"] ?? "").slice(0, 600),
        })),
      },
    })
    .eq("id", parentId);

  await logActivity(supabase, {
    userId,
    businessId: parent.business_id,
    agentId: parent.agent_id,
    taskId: parentId,
    action: status === "completed" ? "objective_completed" : "objective_failed",
    status,
    metadata: { completed: completed.length, failed: failed.length },
  });
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
  if (task.status === "completed") throw new Error("This task is already completed.");
  if (task.status === "cancelled") throw new Error("This task was cancelled.");
  if (task.task_type === "objective") throw new Error("Run the individual steps of an objective instead.");

  const { data: agent } = await supabase
    .from("business_agents")
    .select("id, status, objective, business_id")
    .eq("id", task.agent_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) throw new Error("Agent not found.");
  if (agent.status !== "active") throw new Error("The agent is paused. Resume it to run tasks.");

  const { data: claimed } = await supabase
    .from("agent_tasks")
    .update({
      status: "running",
      error_message: null,
      started_at: new Date().toISOString(),
      retry_count: task.status === "failed" ? (task.retry_count ?? 0) + 1 : (task.retry_count ?? 0),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "failed"])
    .select()
    .maybeSingle();
  if (!claimed) throw new Error("This task was already picked up.");

  await logActivity(supabase, {
    userId,
    businessId: task.business_id,
    agentId: agent.id,
    taskId,
    action: "task_started",
    status: "running",
    metadata: { agent_type: task.assigned_agent_type ?? "business", retry: claimed.retry_count },
  });

  try {
    const business = await assertBusinessOwned(supabase, userId, task.business_id);
    let objectiveTitle: string | null = null;
    if (task.parent_task_id) {
      const { data: parent } = await supabase.from("agent_tasks").select("title").eq("id", task.parent_task_id).maybeSingle();
      objectiveTitle = parent?.title ?? null;
    }
    const type: SpecialistType = isSpecialistType(task.assigned_agent_type) ? task.assigned_agent_type : "business_strategy";
    const result = await runSpecialist(supabase, userId, business, task, type, objectiveTitle);

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
      metadata: { provider: result.provider, agent_type: type, run_id: result.run_id },
    });
    if (task.parent_task_id) await finalizeParentIfDone(supabase, userId, task.parent_task_id);
    return updated;
  } catch (err) {
    const safeMessage = userSafeError(err);
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
    if (task.parent_task_id) await finalizeParentIfDone(supabase, userId, task.parent_task_id);
    return updated;
  }
}
