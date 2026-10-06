import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminBillingRow {
  user_id: string;
  email: string;
  plan: string;
  status: string;
  renews_on: string | null;
  cancel_at_period_end: boolean;
  invoice_count: number;
  total_paid: number;
  currency: string;
}
export interface AdminInvoiceRow {
  id: string;
  email: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: string;
  pdf_url: string | null;
}

export const getAdminBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const [{ data: users, error: uErr }, { data: subs, error: sErr }] = await Promise.all([
      context.supabase.rpc("staff_list_users"),
      context.supabase.from("subscriptions").select("user_id, plan, status, current_period_end, cancel_at_period_end"),
    ]);
    if (uErr || sErr) throw new Error("Could not load billing data.");

    let invoices: AdminInvoiceRow[] = [];
    let stripeError: string | null = null;
    const key = process.env["STRIPE_SECRET_KEY"];
    if (key) {
      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(key);
        const list = await stripe.invoices.list({ limit: 100 });
        invoices = list.data.map((inv) => ({
          id: inv.id ?? "",
          email: (inv.customer_email ?? "").toLowerCase(),
          number: inv.number,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          created: new Date(inv.created * 1000).toISOString(),
          pdf_url: inv.invoice_pdf ?? null,
        }));
      } catch (e) {
        console.error("admin billing stripe", e);
        stripeError = "Could not load invoices from Stripe.";
      }
    }

    const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));
    const rows: AdminBillingRow[] = (users ?? []).map((u: { id: string; email: string }) => {
      const s = subByUser.get(u.id);
      const mine = invoices.filter((i) => i.email === u.email.toLowerCase());
      return {
        user_id: u.id,
        email: u.email,
        plan: s?.plan ?? "free",
        status: s?.status ?? "none",
        renews_on: s?.current_period_end ?? null,
        cancel_at_period_end: s?.cancel_at_period_end ?? false,
        invoice_count: mine.length,
        total_paid: mine.reduce((t, i) => t + i.amount_paid, 0) / 100,
        currency: mine[0]?.currency ?? "usd",
      };
    });

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      event_type: "admin_view_billing",
      event_description: "Admin viewed all users' billing",
      metadata: {},
    });

    return { rows, invoices, stripeError };
  });
