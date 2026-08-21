import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Bot, Sparkles, Search, Users, Target, Megaphone, UserPlus, BarChart3, Zap, Shield, Lock } from 'lucide-react';
import type { Business, AIAgentRun } from '@/lib/types';

const AGENTS = [
  { type: 'market_research', name: 'Market Research Agent', icon: Search, description: 'Researches and summarizes market opportunities for your business idea.', permissions: ['Read: business data', 'Read: market context'], color: 'primary' },
  { type: 'competitor', name: 'Competitor Agent', icon: Users, description: 'Identifies competitors and compares pricing, features, positioning, strengths, and weaknesses.', permissions: ['Read: business data', 'Read: competitor context'], color: 'warning' },
  { type: 'business_strategy', name: 'Business Strategy Agent', icon: Target, description: 'Creates practical business strategies based on your goals and constraints.', permissions: ['Read: business data', 'Write: plan sections'], color: 'primary' },
  { type: 'marketing', name: 'Marketing Agent', icon: Megaphone, description: 'Generates campaigns, content plans, and social media strategies.', permissions: ['Read: business data', 'Write: marketing content'], color: 'accent' },
  { type: 'sales', name: 'Sales Agent', icon: UserPlus, description: 'Helps qualify leads and generate customer communication templates.', permissions: ['Read: leads', 'Read: customers', 'Write: templates'], color: 'accent' },
  { type: 'analytics', name: 'Analytics Agent', icon: BarChart3, description: 'Analyzes business metrics and recommends actions based on actual results.', permissions: ['Read: revenue records', 'Read: leads', 'Read: customers'], color: 'primary' },
  { type: 'optimization', name: 'Optimization Agent', icon: Zap, description: 'Compares goals versus actual performance and suggests adjustments.', permissions: ['Read: milestones', 'Read: tasks', 'Read: revenue'], color: 'warning' },
] as const;

const AGENT_RESTRICTIONS = [
  'Cannot change account ownership',
  'Cannot change subscription prices',
  'Cannot access another user\'s data',
  'Cannot reveal system secrets',
  'Cannot retrieve API keys',
  'Cannot disable security controls',
  'Cannot execute arbitrary server commands',
  'Cannot make financial transactions without explicit authorization',
];

export function AgentsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [runs, setRuns] = useState<AIAgentRun[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setBusinesses(data as Business[] ?? []);
      const { data: runData } = await supabase.from('ai_agent_runs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      setRuns(runData as AIAgentRun[] ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="AI Agents" description="Modular AI agents with scoped permissions" /><EmptyState icon={Bot} title="No agents available yet" description="Create a business to start using AI agents." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  return (
    <div>
      <PageHeader title="AI Agents" description="Modular AI agents with scoped permissions" />

      <div className="card p-4 mb-6 bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary-700 dark:text-primary-400">Agent Security Restrictions</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">All agents operate under strict permissions. They cannot:</p>
            <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-slate-600 dark:text-slate-400">
              {AGENT_RESTRICTIONS.map((r, i) => <li key={i} className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-400" /> {r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const agentRuns = runs.filter((r) => r.agent_type === agent.type);
          return (
            <div key={agent.type} className="card p-5 hover:shadow-md transition">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${agent.color}-50 dark:bg-${agent.color}-500/10 text-${agent.color}-600`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{agentRuns.length} runs</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{agent.description}</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Permissions:</p>
                {agent.permissions.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="w-3 h-3" /> {p}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {runs.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Recent Agent Runs</h3>
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="card p-3 flex items-center gap-3">
                <span className={`badge ${r.status === 'completed' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : r.status === 'failed' ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{r.status}</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{r.agent_type.replace('_', ' ')}</span>
                <span className="text-xs text-slate-400 ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
