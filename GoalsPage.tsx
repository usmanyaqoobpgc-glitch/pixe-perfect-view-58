import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Target, Sparkles, Check, Clock, Circle } from 'lucide-react';
import type { Business, Milestone } from '@/lib/types';

export function GoalsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setBusinesses(data as Business[] ?? []);
      if (data && data.length > 0) {
        setSelectedBiz(data[0].id);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedBiz) return;
    supabase.from('milestones').select('*').eq('business_id', selectedBiz).order('target_day').then(({ data }) => {
      setMilestones(data as Milestone[] ?? []);
    });
  }, [selectedBiz]);

  const toggleMilestone = async (m: Milestone) => {
    const newStatus = m.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('milestones').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', m.id);
    setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, status: newStatus as Milestone['status'], completed_at: newStatus === 'completed' ? new Date().toISOString() : null } : x));
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="Business Goals" description="Track your 30/60/90-day milestones" />
        <EmptyState icon={Target} title="No goals to track yet" description="Create a business first, then generate a plan to get milestones." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} />
      </div>
    );
  }

  const grouped = { 30: [] as Milestone[], 60: [] as Milestone[], 90: [] as Milestone[] };
  milestones.forEach((m) => grouped[m.target_day as 30 | 60 | 90]?.push(m));

  return (
    <div>
      <PageHeader title="Business Goals" description="Track your 30/60/90-day milestones" />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => (
          <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>
            {b.name}
          </button>
        ))}
      </div>

      {milestones.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400 mb-4">No milestones for this business yet.</p>
          <Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Generate Plan</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([30, 60, 90] as const).map((day) => (
            <div key={day} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 flex items-center justify-center text-sm font-bold">{day}</div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Day {day}</h3>
              </div>
              <div className="space-y-3">
                {(grouped[day] ?? []).map((m) => (
                  <button key={m.id} onClick={() => toggleMilestone(m)} className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-primary-300 transition">
                    <div className="flex items-start gap-2">
                      {m.status === 'completed' ? <Check className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" /> : m.status === 'in_progress' ? <Clock className="w-4 h-4 text-warning-500 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${m.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{m.title}</p>
                        {m.description && <p className="text-xs text-slate-400 mt-1">{m.description}</p>}
                      </div>
                    </div>
                  </button>
                ))}
                {(grouped[day] ?? []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">No milestones for this period</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
