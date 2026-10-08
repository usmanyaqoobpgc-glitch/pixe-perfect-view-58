import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid("Invalid id");

export const listChatThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("agent_chat_threads")
      .select("id, title, updated_at")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load conversations.");
    return rows ?? [];
  });

export const createChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agent_chat_threads")
      .insert({ business_id: data.businessId, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not start a conversation.");
    return row;
  });

export const deleteChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ threadId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_chat_threads").delete().eq("id", data.threadId).eq("user_id", context.userId);
    if (error) throw new Error("Could not delete the conversation.");
    return { ok: true };
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ threadId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("agent_chat_messages")
      .select("id, role, mode, content, created_at")
      .eq("thread_id", data.threadId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load messages.");
    return rows ?? [];
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      threadId: id,
      mode: z.enum(["chat", "document"]),
      content: z.string().trim().min(1).max(8000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: thread, error: tErr } = await sb
      .from("agent_chat_threads")
      .select("id, business_id, title")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (tErr || !thread) throw new Error("Conversation not found.");

    const { data: prior } = await sb
      .from("agent_chat_messages")
      .select("role, content")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    const { error: uErr } = await sb.from("agent_chat_messages").insert({
      thread_id: thread.id, user_id: context.userId, role: "user", mode: data.mode, content: data.content,
    });
    if (uErr) throw new Error("Could not save your message.");

    const history = [
      ...((prior ?? []) as { role: "user" | "assistant"; content: string }[]),
      { role: "user" as const, content: data.content },
    ];
    const { agentChat } = await import("./agent.server");
    const b = await import("./brand-style.server");
    const style = await b.loadBrandStyle(sb, thread.business_id);
    const res = await b.withBrandStyle(style, () =>
      agentChat(sb, context.userId, thread.business_id, history, data.mode),
    );

    const { error: aErr } = await sb.from("agent_chat_messages").insert({
      thread_id: thread.id, user_id: context.userId, role: "assistant", mode: data.mode, content: res.reply,
    });
    if (aErr) throw new Error("Could not save the agent's reply.");

    const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (thread.title === "New conversation") patch.title = data.content.slice(0, 60);
    await sb.from("agent_chat_threads").update(patch).eq("id", thread.id);
    return { reply: res.reply };
  });
