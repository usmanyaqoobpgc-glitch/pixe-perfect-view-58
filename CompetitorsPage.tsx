import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Users, Sparkles } from 'lucide-react';
import type { Business, BusinessPlan } from '@/lib/types';

export function CompetitorsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [plan, setPlan] = useState<BusinessPlan | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setBusinesses(data as Business[] ?? []);
      if (data && data.length > 0) setSelectedBiz(data[0].id);
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedBiz) return;
    supabase.from('business_plans').select('*').eq('business_id', selectedBiz).eq('section_key', 'competitor_research').maybeSingle().then(({ data }) => {
      setPlan(data as BusinessPlan | null);
    });
  }, [selectedBiz]);

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="Competitor Analysis" description="Identify and compare competitors" />
        <EmptyState icon={Users} title="No competitor analysis yet" description="Create a business and generate a plan to get competitor research." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Competitor Analysis" description="Identify and compare competitors" />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => (
          <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>
        ))}
      </div>

      {plan ? (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Competitor Overview</h3>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
            <p>{(plan.content as { overview?: string }).overview ?? 'No competitor data available.'}</p>
            {(plan.content as { competitors?: { name: string; strength: string; weakness: string }[] }).competitors?.map((c, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                <p className="text-xs mt-1"><span className="text-accent-600">Strength:</span> {c.strength}</p>
                <p className="text-xs"><span className="text-error-600">Weakness:</span> {c.weakness}</p>
              </div>
            ))}
          </div>
          {plan.reasoning && <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">AI reasoning: {plan.reasoning}</p>}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400 mb-4">No competitor analysis generated yet.</p>
          <Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Generate Plan</Link>
        </div>
      )}
    </div>
  );
}
