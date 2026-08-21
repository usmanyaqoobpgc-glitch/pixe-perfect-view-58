import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Search, Sparkles, Bot } from 'lucide-react';
import type { Business, AIAgentRun, BusinessPlan } from '@/lib/types';

export function MarketResearchPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [research, setResearch] = useState<BusinessPlan | null>(null);
  const [runs, setRuns] = useState<AIAgentRun[]>([]);

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
    supabase.from('business_plans').select('*').eq('business_id', selectedBiz).in('section_key', ['idea_analysis', 'target_audience', 'market_positioning', 'competitor_research']).then(({ data }) => {
      setResearch((data as BusinessPlan[] ?? [])[0] ?? null);
    });
    supabase.from('ai_agent_runs').select('*').eq('business_id', selectedBiz).eq('agent_type', 'market_research').order('created_at', { ascending: false }).limit(5).then(({ data }) => {
      setRuns(data as AIAgentRun[] ?? []);
    });
  }, [selectedBiz]);

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="Market Research" description="AI-powered market analysis and opportunities" />
        <EmptyState icon={Search} title="No market research yet" description="Create a business and generate a plan to get market analysis." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Market Research" description="AI-powered market analysis and opportunities" />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => (
          <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>
        ))}
      </div>

      {research ? (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Market Analysis</h3>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
            <p>{(research.content as { summary?: string }).summary ?? 'Market analysis not available.'}</p>
          </div>
          {research.reasoning && <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">AI reasoning: {research.reasoning}</p>}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400 mb-4">No market research generated yet. Generate a business plan to get started.</p>
          <Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Generate Plan</Link>
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Agent Run History</h3>
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="card p-3 flex items-center gap-3">
                <span className={`badge ${r.status === 'completed' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{r.status}</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
