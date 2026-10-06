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

// Secret lookup: the locked `app_secrets` table (service role only) first, then the env var of the same name.
async function getAppSecret(name: string): Promise<string | undefined> {
  let value: string | undefined;
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
    const { data } = await db.from("app_secrets").select("value").eq("name", name).maybeSingle();
    value = data?.value || undefined;
  } catch {
    value = undefined;
  }
  return value || process.env[name];
}

async function getStripe(): Promise<Stripe> {
  const key = await getAppSecret("STRIPE_SECRET_KEY");
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

// The paid plan is granted only while payment is in good standing (never for incomplete / past_due / canceled).
const LIVE_STATUSES = new Set<string>(["active", "trialing"]);
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

// Plan state for a known Stripe customer: one subscription list call, Stripe is the source of truth.
async function loadByCustomerId(stripe: Stripe, customerId: string): Promise<Loaded> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const live = subs.data.find((s) => LIVE_STATUSES.has(s.status));
  if (!live) {
    const pastDue = subs.data.some((s) => s.status === "past_due");
    const hadPaid = subs.data.some((s) => s.status === "canceled");
    const dbStatus: DbStatus = pastDue ? "past_due" : hadPaid ? "canceled" : "active";
    return { state: FREE_STATE, customerId, subscriptionId: null, dbStatus };
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

async function loadSubscription(stripe: Stripe, email: string): Promise<Loaded> {
  const customerId = await findCustomerByEmail(stripe, email);
  if (!customerId) return { state: FREE_STATE, customerId: null, subscriptionId: null, dbStatus: "active" };
  return loadByCustomerId(stripe, customerId);
}

async function persistRow(userId: string, loaded: Loaded): Promise<void> {
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
  if (error) throw new Error(`subscription sync failed: ${error.message}`);
}

export async function checkSubscription(email: string): Promise<SubscriptionState> {
  return (await loadSubscription(await getStripe(), email)).state;
}

// Persists the current Stripe state into the subscriptions table (service role; RLS denies user writes).
export async function syncSubscriptionRow(userId: string, email: string): Promise<SubscriptionState> {
  const loaded = await loadSubscription(await getStripe(), email);
  try {
    await persistRow(userId, loaded);
  } catch (e) {
    console.error("[billing]", e instanceof Error ? e.message : e);
  }
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


const WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function customerIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as { customer?: string | { id: string } | null };
  const c = obj.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

// Stripe -> app: keeps the subscriptions table in sync automatically after a payment.
// The event payload is NOT trusted for plan data: after verifying the signature we only read the
// customer id and then re-fetch the real subscription state from Stripe.
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = await getAppSecret("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const stripe = await getStripe();
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (!WEBHOOK_EVENTS.has(event.type)) return Response.json({ received: true, ignored: true });

  const customerId = customerIdFromEvent(event);
  if (!customerId) return Response.json({ received: true, ignored: true });

  try {
    const customer = await stripe.customers.retrieve(customerId);
    const email = "deleted" in customer && customer.deleted ? null : (customer as Stripe.Customer).email;
    if (!email) return Response.json({ received: true, ignored: true });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    if (!profile) return Response.json({ received: true, ignored: "no matching user" });

    const loaded = await loadByCustomerId(stripe, customerId);
    await persistRow(profile.id, loaded);
    return Response.json({ received: true });
  } catch (e) {
    console.error("[stripe-webhook]", e instanceof Error ? e.message : e);
    // 500 makes Stripe retry later; the handler is idempotent (state is re-read from Stripe and upserted).
    return new Response("Webhook handler error", { status: 500 });
  }
}
