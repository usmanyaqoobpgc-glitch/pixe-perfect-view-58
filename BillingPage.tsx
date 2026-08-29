import { PageHeader } from '@/components/ui';
import { CreditCard, Check, Zap, Crown, AlertCircle } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    icon: CreditCard,
    features: ['1 business', 'Basic AI planner', 'Core dashboard', 'Community support'],
    current: true,
  },
  {
    name: 'Pro',
    price: '$29',
    icon: Zap,
    features: ['5 businesses', 'Full AI planner', 'Website builder', 'AI agents', 'CSV export', 'Email support'],
    current: false,
  },
  {
    name: 'Business',
    price: '$99',
    icon: Crown,
    features: ['Unlimited businesses', 'All AI agents', 'Advanced analytics', 'Priority support', 'API access', 'Team collaboration'],
    current: false,
  },
];

export function BillingPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription" />

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-slate-400">Current Plan</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">Free Plan</p>
            <p className="text-xs text-slate-400 mt-1">No payment method on file.</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Billing Cycle</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">—</p>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 text-sm flex items-start gap-2">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Payment integration requires manual setup</p>
          <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">
            To accept payments and manage subscriptions, a Stripe integration must be configured.
            This is not yet connected. All pricing shown is for display purposes only — no charges will be made.
          </p>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Available Plans</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.name}
              className={`card p-6 ${plan.current ? 'border-primary-500 dark:border-primary-500/50' : ''}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${plan.current ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {plan.price}
                {plan.price !== '$0' && <span className="text-sm font-normal text-slate-400">/mo</span>}
              </p>
              {plan.current && (
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
              {!plan.current && (
                <button
                  disabled
                  className="btn-secondary w-full mt-6 text-sm"
                  title="Payment integration not yet configured"
                >
                  Upgrade (Requires Setup)
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Billing History</h3>
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">No billing history. You are on the free plan.</p>
        </div>
      </div>
    </div>
  );
}
