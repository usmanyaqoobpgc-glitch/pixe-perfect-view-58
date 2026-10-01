// Server-only Stripe billing helpers. Never import from client code.
import Stripe from "stripe";

export const PLANS = {
  pro: {
    name: "Pro",
    priceId: "price_1ULbzH1kHi27baPIX5sH219J",
    productId: "prod_VMKeZUiRjfduWW",
    amount: 2900,
  },
  business: {
    name: "Business",
    priceId: "price_1ULbzL1kHi27baPIhEbHDMJ7",
    productId: "prod_VMKep55ElanvI5",
    amount: 9900,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured yet.");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

function planFromProductId(productId: string | undefined): PlanKey | null {
  if (!productId) return null;
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.productId === productId) return key as PlanKey;
  }
  return null;
}

async function findCustomerByEmail(stripe: Stripe, email: string): Promise<string | null> {
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0]?.id ?? null;
}

export interface SubscriptionState {
  subscribed: boolean;
  plan: PlanKey | "free";
  planName: string;
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function checkSubscription(email: string): Promise<SubscriptionState> {
  const stripe = getStripe();
  const customerId = await findCustomerByEmail(stripe, email);
  if (!customerId) {
    return { subscribed: false, plan: "free", planName: "Free", subscriptionEnd: null, cancelAtPeriodEnd: false };
  }
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  const sub = subs.data[0];
  if (!sub) {
    return { subscribed: false, plan: "free", planName: "Free", subscriptionEnd: null, cancelAtPeriodEnd: false };
  }
  const item = sub.items.data[0];
  const productId = typeof item?.price.product === "string" ? item.price.product : item?.price.product?.id;
  const plan = planFromProductId(productId);
  return {
    subscribed: true,
    plan: plan ?? "free",
    planName: plan ? PLANS[plan].name : "Free",
    subscriptionEnd: new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

// Persists the current Stripe state into the subscriptions table (service role; RLS denies user writes).
export async function syncSubscriptionRow(userId: string, email: string): Promise<SubscriptionState> {
  const state = await checkSubscription(email);
  const stripe = getStripe();
  const customerId = await findCustomerByEmail(stripe, email);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const subs = customerId
    ? await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 })
    : { data: [] as Stripe.Subscription[] };
  const sub = subs.data[0];
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: state.plan,
      status: state.subscribed ? (state.cancelAtPeriodEnd ? "cancelling" : "active") : "free",
      stripe_customer_id: customerId,
      stripe_subscription_id: sub?.id ?? null,
      current_period_end: state.subscriptionEnd,
      cancel_at_period_end: state.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("[billing] subscription sync failed:", error.message);
  return state;
}

export async function createCheckoutSession(opts: {
  email: string;
  plan: PlanKey;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const plan = PLANS[opts.plan];
  if (!plan) throw new Error("Unknown plan.");
  const customerId = await findCustomerByEmail(stripe, opts.email);
  const session = await stripe.checkout.sessions.create({
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : opts.email,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${opts.origin}/billing?checkout=success`,
    cancel_url: `${opts.origin}/billing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createPortalSession(email: string, origin: string): Promise<string> {
  const stripe = getStripe();
  const customerId = await findCustomerByEmail(stripe, email);
  if (!customerId) throw new Error("No Stripe customer found for this account yet.");
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  });
  return session.url;
}

export interface InvoiceRow {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: string;
  pdfUrl: string | null;
}

export async function listInvoices(email: string): Promise<InvoiceRow[]> {
  const stripe = getStripe();
  const customerId = await findCustomerByEmail(stripe, email);
  if (!customerId) return [];
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 24 });
  return invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    status: inv.status,
    created: new Date(inv.created * 1000).toISOString(),
    pdfUrl: inv.invoice_pdf ?? null,
  }));
}
