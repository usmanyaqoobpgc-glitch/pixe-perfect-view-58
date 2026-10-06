// Server-only Stripe billing helpers. Never import from client code.
import Stripe from "stripe";

export const PLANS = {
  pro: {
    name: "Pro",
    productId: "prod_VMKeZUiRjfduWW",
    amount: 2900,
  },
  business: {
    name: "Business",
    productId: "prod_VMKep55ElanvI5",
    amount: 9900,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Key lookup: the locked `app_secrets` table (service role only) first, then the STRIPE_SECRET_KEY env var.
async function getStripe(): Promise<Stripe> {
  let key: string | undefined;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: { value?: string } | null }>;
          };
        };
      };
    };
    const { data } = await db.from("app_secrets").select("value").eq("name", "STRIPE_SECRET_KEY").maybeSingle();
    key = data?.value || undefined;
  } catch {
    key = undefined;
  }
  key = key || process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured yet.");
  return new Stripe(key);
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

// Statuses that still entitle the user to their paid plan.
const LIVE_STATUSES = new Set<string>(["active", "trialing", "past_due"]);
// Statuses the `subscriptions.status` CHECK constraint accepts.
type DbStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

const FREE_STATE: SubscriptionState = {
  subscribed: false,
  plan: "free",
  planName: "Free",
  subscriptionEnd: null,
  cancelAtPeriodEnd: false,
};

interface Loaded {
  state: SubscriptionState;
  customerId: string | null;
  subscriptionId: string | null;
  dbStatus: DbStatus;
}

// One customer lookup + one subscription list per call (no duplicate Stripe requests).
async function loadSubscription(stripe: Stripe, email: string): Promise<Loaded> {
  const customerId = await findCustomerByEmail(stripe, email);
  if (!customerId) return { state: FREE_STATE, customerId: null, subscriptionId: null, dbStatus: "active" };

  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const live = subs.data.find((s) => LIVE_STATUSES.has(s.status));
  if (!live) {
    const hadPaid = subs.data.some((s) => s.status === "canceled");
    return { state: FREE_STATE, customerId, subscriptionId: null, dbStatus: hadPaid ? "canceled" : "active" };
  }

  const item = live.items.data[0];
  const productId = typeof item?.price.product === "string" ? item.price.product : item?.price.product?.id;
  const metaPlan = live.metadata?.plan;
  const plan: PlanKey | null =
    metaPlan === "pro" || metaPlan === "business" ? metaPlan : planFromProductId(productId);
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end;
  return {
    state: {
      subscribed: true,
      plan: plan ?? "free",
      planName: plan ? PLANS[plan].name : "Free",
      subscriptionEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: live.cancel_at_period_end,
    },
    customerId,
    subscriptionId: live.id,
    dbStatus: live.status as DbStatus,
  };
}

export async function checkSubscription(email: string): Promise<SubscriptionState> {
  return (await loadSubscription(await getStripe(), email)).state;
}

// Persists the current Stripe state into the subscriptions table (service role; RLS denies user writes).
export async function syncSubscriptionRow(userId: string, email: string): Promise<SubscriptionState> {
  const loaded = await loadSubscription(await getStripe(), email);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: loaded.state.plan,
      status: loaded.dbStatus,
      stripe_customer_id: loaded.customerId,
      stripe_subscription_id: loaded.subscriptionId,
      current_period_end: loaded.state.subscriptionEnd,
      cancel_at_period_end: loaded.state.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("[billing] subscription sync failed:", error.message);
  return loaded.state;
}

export async function createCheckoutSession(opts: {
  email: string;
  plan: PlanKey;
  origin: string;
}): Promise<string> {
  const stripe = await getStripe();
  const plan = PLANS[opts.plan];
  if (!plan) throw new Error("Unknown plan.");
  const customerId = await findCustomerByEmail(stripe, opts.email);
  const session = await stripe.checkout.sessions.create({
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : opts.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: plan.amount,
          recurring: { interval: "month" },
          product_data: { name: `${plan.name} plan` },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    subscription_data: { metadata: { plan: opts.plan } },
    payment_method_types: ["card"],
    success_url: `${opts.origin}/billing?checkout=success`,
    cancel_url: `${opts.origin}/billing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createPortalSession(email: string, origin: string): Promise<string> {
  const stripe = await getStripe();
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
  const stripe = await getStripe();
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
