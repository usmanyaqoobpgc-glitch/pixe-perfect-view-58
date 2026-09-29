import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrandStyle = { voice: string; writing_style: string; response_length: "short" | "medium" | "long"; brand_notes: string };

const store = new AsyncLocalStorage<BrandStyle | null>();

const LENGTH_HINT: Record<string, string> = {
  short: "Keep outputs concise: short paragraphs, tight bullet lists, no filler.",
  medium: "Use a moderate length: enough detail to act on, without padding.",
  long: "Be thorough and detailed: full sections, examples and specifics.",
};

export function brandInstruction(style: BrandStyle | null | undefined): string {
  if (!style) return "";
  return [
    `Brand voice: ${style.voice}. Writing style: ${style.writing_style}.`,
    LENGTH_HINT[style.response_length] ?? "",
    style.brand_notes ? `Brand guidelines from the owner: ${style.brand_notes}` : "",
    "Write all prose (not JSON keys) in this voice.",
  ].filter(Boolean).join("\n");
}

export function currentBrandStyle(): BrandStyle | null {
  return store.getStore() ?? null;
}

export async function loadBrandStyle(supabase: SupabaseClient<any, any, any>, businessId: string): Promise<BrandStyle | null> {
  const { data } = await supabase
    .from("business_agents")
    .select("voice, writing_style, response_length, brand_notes")
    .eq("business_id", businessId)
    .maybeSingle();
  return (data as BrandStyle | null) ?? null;
}

export async function loadBrandStyleForTask(supabase: SupabaseClient<any, any, any>, taskId: string): Promise<BrandStyle | null> {
  const { data } = await supabase.from("agent_tasks").select("business_id").eq("id", taskId).maybeSingle();
  return data?.business_id ? loadBrandStyle(supabase, data.business_id as string) : null;
}

export function withBrandStyle<T>(style: BrandStyle | null, fn: () => Promise<T>): Promise<T> {
  return store.run(style, fn);
}
