import type { SupabaseClient } from "@supabase/supabase-js";

export async function deleteAccount(supabase: SupabaseClient, userId: string) {
  // Audit the request as the caller (RLS applies) before privileged deletion.
  await supabase.from("security_events").insert({
    user_id: userId,
    event_type: "admin_action",
    metadata: { action: "account_deletion_requested" },
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Account deletion failed:", error.message);
    return { success: false as const, error: "Failed to delete account" };
  }
  return { success: true as const };
}
