import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SECTION_KEYS,
  generatePlan,
  type BusinessInput,
  type PlanSection,
} from "./plan-template";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are an expert business strategist AI. Generate a comprehensive business plan as JSON.
Return an object with a single "sections" array. Each item must have exactly these fields:
- "key": one of ${JSON.stringify(SECTION_KEYS)}
- "content": an object with relevant fields for that section
- "reasoning": a short string explaining the analysis behind this section

The array must contain exactly one object per key, in the order listed. Return only JSON.`;

function buildUserPrompt(business: BusinessInput): string {
  return `Generate a detailed business plan for this business:
- Idea: ${business.idea}
- Budget: $${business.budget}
- Country: ${business.country ?? "Not specified"}
- Target customer: ${business.target_customer ?? "General audience"}
- Skills: ${(business.skills ?? []).join(", ") || "None specified"}
- Available time: ${business.available_time_hours_per_week ?? "Not specified"} hours/week
- Business model: ${business.business_model ?? "Services"}
- Revenue target: $${business.revenue_target}
- Target deadline: ${business.target_deadline ?? "Not specified"}
- Marketing channels: ${(business.marketing_channels ?? []).join(", ") || "Not specified"}

For "milestones", content.items must be an array of objects with "day" (30, 60 or 90), "title" and "description".
For "daily_tasks", content.items must be an array of objects with "title", "description" and "priority" (low, medium, high or urgent).
For "pricing_strategy", content.tiers must be an array of objects with "name", "price" and "description".
For "revenue_targets", content.total must be a number and content.breakdown an array of objects with "month", "target" (number) and "description".
Keep every section concrete, actionable and grounded in the budget and time available.`;
}

function coerceSections(raw: unknown): PlanSection[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { sections?: unknown })?.sections)
      ? (raw as { sections: unknown[] }).sections
      : [];

  const validKeys = new Set<string>(SECTION_KEYS);
  const result: PlanSection[] = [];

  for (const section of list) {
    if (typeof section !== "object" || section === null) continue;
    const s = section as Record<string, unknown>;
    const key = String(s["key"] ?? "");
    if (!validKeys.has(key)) continue;
    if (typeof s["content"] !== "object" || s["content"] === null) continue;
    if (typeof s["reasoning"] !== "string") continue;
    result.push({
      key,
      content: s["content"] as Record<string, unknown>,
      reasoning: s["reasoning"],
    });
  }

  return result;
}

/** Accumulates the assistant message content from an SSE chat-completions stream. */
export async function readStreamedContent(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("AI gateway returned an empty response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index: number;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
        };
        content +=
          chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  return content;
}

/**
 * Calls the Lovable AI gateway. The API key never leaves the server: it is read
 * from the runtime secret LOVABLE_API_KEY inside this handler.
 */
export async function generatePlanWithLLM(business: BusinessInput): Promise<PlanSection[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(business) },
      ],
      response_format: { type: "json_object" },
      // Stream so bytes keep flowing during the long generation; a buffered
      // request stays silent for minutes and gets severed by the platform,
      // which surfaces in the browser as "Failed to fetch".
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI gateway error ${response.status}: ${detail.slice(0, 300)}`);
  }

  const content = await readStreamedContent(response);
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");


  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI response was not valid JSON");
  }

  const sections = coerceSections(parsed);
  if (sections.length === 0) throw new Error("AI response contained no valid sections");
  return sections;
}

/** Section keys already persisted for a business (deduplicated). */
async function persistedSectionKeys(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("business_plans")
    .select("section_key")
    .eq("business_id", businessId);
  return Array.from(new Set((data ?? []).map((r) => String(r.section_key))));
}

export async function buildAndStorePlan(
  supabase: SupabaseClient,
  businessId: string,
  business: BusinessInput,
  regenerateSection?: string,
): Promise<{ sections: string[]; source: "llm" | "template" | "existing" }> {
  // Idempotency: if a previous (possibly disconnected) run already persisted the
  // full plan, never call the gateway again — just return what exists.
  if (!regenerateSection) {
    const existing = await persistedSectionKeys(supabase, businessId);
    if (existing.length >= SECTION_KEYS.length) {
      return { sections: existing, source: "existing" };
    }
  }

  let sections: PlanSection[];
  let source: "llm" | "template" = "llm";


  try {
    sections = await generatePlanWithLLM(business);
  } catch (err) {
    console.error(
      "LLM generation failed, falling back to template:",
      err instanceof Error ? err.message : String(err),
    );
    sections = generatePlan(business);
    source = "template";
  }

  if (regenerateSection) {
    sections = sections.filter((s) => s.key === regenerateSection);
    if (sections.length === 0) {
      sections = generatePlan(business).filter((s) => s.key === regenerateSection);
      source = "template";
    }
  }

  const planRows = sections.map((s) => ({
    business_id: businessId,
    section_key: s.key,
    content: s.content,
    reasoning: s.reasoning,
  }));

  const { error: upsertErr } = await supabase
    .from("business_plans")
    .upsert(planRows, { onConflict: "business_id,section_key" });
  if (upsertErr) console.error("Plan upsert error:", upsertErr.message);

  if (!regenerateSection) {
    const milestoneRows = sections
      .filter((s) => s.key === "milestones")
      .flatMap((s) => {
        const items =
          (s.content as { items?: { title: string; description: string; day: number }[] }).items ??
          [];
        return items.map((m) => ({
          business_id: businessId,
          title: m.title,
          description: m.description,
          target_day: [30, 60, 90].includes(Number(m.day)) ? Number(m.day) : 30,
          status: "pending",
        }));
      });
    if (milestoneRows.length > 0) {
      // Replace instead of append so a re-run can't duplicate rows.
      await supabase.from("milestones").delete().eq("business_id", businessId);
      const { error } = await supabase.from("milestones").insert(milestoneRows);
      if (error) console.error("Milestone insert error:", error.message);
    }


    const taskRows = sections
      .filter((s) => s.key === "daily_tasks")
      .flatMap((s) => {
        const items =
          (s.content as { items?: { title: string; description: string; priority: string }[] })
            .items ?? [];
        return items.map((t) => ({
          business_id: businessId,
          title: t.title,
          description: t.description,
          priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
          status: "todo",
        }));
      });
    if (taskRows.length > 0) {
      await supabase.from("tasks").delete().eq("business_id", businessId);
      const { error } = await supabase.from("tasks").insert(taskRows);
      if (error) console.error("Task insert error:", error.message);
    }

  }

  return { sections: sections.map((s) => s.key), source };
}

export async function runPlanner(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  regenerateSection?: string,
) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!business) throw new Error("Business not found");

  return buildAndStorePlan(supabase, businessId, business as BusinessInput, regenerateSection);
}
