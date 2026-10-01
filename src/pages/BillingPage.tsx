import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui';
import { CreditCard, Check, Zap, Crown, RefreshCw, ExternalLink, FileText } from 'lucide-react';
import {
  getSubscriptionState,
  createCheckout,
  openCustomerPortal,
  getInvoices,
} from '@/lib/billing.functions';

const PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    price: '$0',
    icon: CreditCard,
    features: ['1 business', 'Basic AI planner', 'Core dashboard', 'Community support'],
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '$29',
    icon: Zap,
    features: ['5 businesses', 'Full AI planner', 'Website builder', 'AI agents', 'CSV export', 'Email support'],
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: '$99',
    icon: Crown,
    features: ['Unlimited businesses', 'All AI agents', 'Advanced analytics', 'Priority support', 'API access', 'Team collaboration'],
  },
];

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { checkout?: string };
  const checkoutResult = search.checkout;
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchState = useServerFn(getSubscriptionState);
  const fetchInvoices = useServerFn(getInvoices);
  const startCheckout = useServerFn(createCheckout);
  const startPortal = useServerFn(openCustomerPortal);

  const stateQuery = useQuery({
    queryKey: ['subscription-state'],
    queryFn: () => fetchState(),
  });
  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => fetchInvoices(),
  });

  // After returning from Stripe checkout, poll until the subscription shows active.
  useEffect(() => {
    if (checkoutResult !== 'success') return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      queryClient.invalidateQueries({ queryKey: ['subscription-state'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      if (attempts >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [checkoutResult, queryClient]);

  const state = stateQuery.data;
  const currentPlan = state?.plan ?? 'free';

  const handleUpgrade = async (plan: 'pro' | 'business') => {
    setBusy(plan);
    setActionError(null);
    try {
      const { url } = await startCheckout({ data: { plan, origin: window.location.origin } });
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start checkout.');
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy('portal');
    setActionError(null);
    try {
      const { url } = await startPortal({ data: { origin: window.location.origin } });
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the billing portal.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription" />

      {checkoutResult === 'success' && (
        <div className="mb-6 p-4 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400 text-sm">
          Payment received — your plan is being activated. This can take a few seconds; the page refreshes automatically.
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div className="mb-6 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm">
          Checkout was cancelled. No charge was made — you can upgrade whenever you're ready.
        </div>
      )}
      {actionError && (
        <div className="mb-6 p-4 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 text-sm">
          {actionError}
        </div>
      )}

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-slate-400">Current Plan</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {stateQuery.isLoading ? 'Loading…' : `${state?.planName ?? 'Free'} Plan`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {state?.subscribed
                ? state.cancelAtPeriodEnd
                  ? `Cancels on ${new Date(state.subscriptionEnd!).toLocaleDateString()}`
                  : `Renews on ${new Date(state.subscriptionEnd!).toLocaleDateString()}`
                : 'No payment method on file.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['subscription-state'] });
                queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
              }}
              disabled={stateQuery.isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${stateQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {state?.subscribed && (
              <button
                className="btn-primary text-sm flex items-center gap-2"
                onClick={handlePortal}
                disabled={busy === 'portal'}
              >
                <ExternalLink className="w-4 h-4" />
                {busy === 'portal' ? 'Opening…' : 'Manage Subscription'}
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Available Plans</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.name}
              className={`card p-6 ${isCurrent ? 'border-primary-500 dark:border-primary-500/50' : ''}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCurrent ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {plan.price}
                {plan.price !== '$0' && <span className="text-sm font-normal text-slate-400">/mo</span>}
              </p>
              {isCurrent && (
                <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400 mb-4">
                  Current Plan
                </span>
              )}
              <ul className="space-y-2 mt-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-4 h-4 text-accent-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.key !== 'free' && (
                <button
                  className="btn-primary w-full mt-6 text-sm"
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={busy !== null}
                >
                  {busy === plan.key ? 'Starting checkout…' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Billing History</h3>
        {invoicesQuery.isLoading ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-400">Loading invoices…</p>
          </div>
        ) : (invoicesQuery.data?.length ?? 0) === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-400">No invoices yet.</p>
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {invoicesQuery.data!.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {inv.number ?? 'Invoice'}
                    </p>
                    <p className="text-xs text-slate-400">{new Date(inv.created).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatMoney(inv.amountPaid, inv.currency)}
                  </span>
                  <span className={`badge ${inv.status === 'paid' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {inv.status ?? 'unknown'}
                  </span>
                  {inv.pdfUrl && (
                    <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
