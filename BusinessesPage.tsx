import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { generateBusinessPlan } from '@/lib/ai-planner.functions';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Briefcase, Sparkles, ChevronRight, Edit3 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Business, BusinessPlan } from '@/lib/types';
import { SECTION_LABELS } from '@/lib/types';

export function BusinessesPage() {
  const regeneratePlan = useServerFn(generateBusinessPlan);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans] = useState<Record<string, BusinessPlan[]>>({});
  const [selected, setSelected] = useState<Business | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setBusinesses(data as Business[] ?? []);
    if (data && data.length > 0) {
      const ids = data.map((b) => b.id);
      const { data: planData } = await supabase
        .from('business_plans').select('*').in('business_id', ids);
      const planMap: Record<string, BusinessPlan[]> = {};
      (planData as BusinessPlan[] ?? []).forEach((p) => {
        if (!planMap[p.business_id]) planMap[p.business_id] = [];
        planMap[p.business_id].push(p);
      });
      setPlans(planMap);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('businesses').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    setSelected(null);
    load();
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0 && !selected) {
    return (
      <div>
        <PageHeader title="My Businesses" description="Manage all your business workspaces" />
        <EmptyState
          icon={Briefcase}
          title="No businesses yet"
          description="Create your first business using the AI Business Planner to get a structured, actionable plan."
          action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>}
        />
      </div>
    );
  }

  if (selected) {
    const businessPlans = plans[selected.id] ?? [];
    return (
      <div>
        <PageHeader
          title={selected.name}
          description={`Budget: ${formatCurrency(Number(selected.budget))} · Target: ${formatCurrency(Number(selected.revenue_target))} · ${formatDate(selected.target_deadline)}`}
          action={<button onClick={() => setSelected(null)} className="btn-secondary">Back to list</button>}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs text-slate-400">Status</p>
            <p className="text-lg font-semibold capitalize">{selected.status}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Business Model</p>
            <p className="text-lg font-semibold">{selected.business_model || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Plan Sections</p>
            <p className="text-lg font-semibold">{businessPlans.length} / 19</p>
          </div>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Business Plan</h3>
        {businessPlans.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-400 mb-4">No plan generated yet.</p>
            <Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Generate Plan</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {businessPlans.map((plan) => {
              const section = plan.section_key;
              const content = plan.content as Record<string, unknown>;
              return (
                <div key={plan.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 dark:text-white">{SECTION_LABELS[section] || section}</h4>
                    <button
                      onClick={async () => {
                        await regeneratePlan({ data: { businessId: selected.id, regenerateSection: section } });
                        load();
                      }}
                      className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                    {renderPlanContent(content)}
                  </div>
                  {plan.reasoning && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400"><span className="font-medium">AI reasoning:</span> {plan.reasoning}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Businesses"
        description="Manage all your business workspaces"
        action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> New Business</Link>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businesses.map((b) => {
          const planCount = plans[b.id]?.length ?? 0;
          return (
            <div key={b.id} className="card p-5 hover:shadow-md transition cursor-pointer" onClick={() => setSelected(b)}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {b.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{b.name}</h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{b.idea}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                    <span className="badge bg-slate-100 dark:bg-slate-800">{b.status}</span>
                    <span>{planCount}/19 sections</span>
                    <span>·</span>
                    <span>{formatCurrency(Number(b.revenue_target))}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Business"
        message="This will permanently delete the business and all its plans, tasks, leads, and data. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function renderPlanContent(content: Record<string, unknown>) {
  return Object.entries(content).map(([key, value]) => {
    if (typeof value === 'string') {
      return <p key={key}>{value}</p>;
    }
    if (Array.isArray(value)) {
      return (
        <ul key={key} className="list-disc list-inside space-y-1">
          {value.map((item, i) => (
            <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="pl-3 border-l-2 border-slate-100 dark:border-slate-800">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <p key={k} className="text-xs"><span className="font-medium capitalize">{k}:</span> {String(v)}</p>
          ))}
        </div>
      );
    }
    return null;
  });
}
