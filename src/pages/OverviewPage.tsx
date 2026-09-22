import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { StatCard, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { CommandBar } from '@/components/CommandBar';
import { Link } from '@tanstack/react-router';
import {
  DollarSign, Target, TrendingUp, CheckSquare, UserPlus, Users2, BarChart3,
  Briefcase, Sparkles, ArrowRight, AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import type { Business, Task, Lead, Customer, RevenueRecord, Milestone, Notification } from '@/lib/types';

export function OverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recommendations, setRecommendations] = useState<Notification[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data: bizData } = await supabase
          .from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        setBusinesses(bizData as Business[] ?? []);

        if (bizData && bizData.length > 0) {
          const bizIds = bizData.map((b) => b.id);
          const [tasksRes, leadsRes, customersRes, revenueRes, milestonesRes] = await Promise.all([
            supabase.from('tasks').select('*').in('business_id', bizIds).order('created_at', { ascending: false }),
            supabase.from('leads').select('*').in('business_id', bizIds).order('created_at', { ascending: false }),
            supabase.from('customers').select('*').in('business_id', bizIds).order('created_at', { ascending: false }),
            supabase.from('revenue_records').select('*').in('business_id', bizIds).order('record_date', { ascending: false }),
            supabase.from('milestones').select('*').in('business_id', bizIds).order('target_day', { ascending: true }),
          ]);
          setTasks(tasksRes.data as Task[] ?? []);
          setLeads(leadsRes.data as Lead[] ?? []);
          setCustomers(customersRes.data as Customer[] ?? []);
          setRevenue(revenueRes.data as RevenueRecord[] ?? []);
          setMilestones(milestonesRes.data as Milestone[] ?? []);
        }

        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'ai')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecommendations(notifData as Notification[] ?? []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  if (loading) return <LoadingState />;

  const totalRevenue = revenue.filter((r) => r.type === 'revenue').reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpenses = revenue.filter((r) => r.type === 'expense').reduce((sum, r) => sum + Number(r.amount), 0);
  const revenueTarget = businesses.reduce((sum, b) => sum + Number(b.revenue_target), 0);
  const progressPct = revenueTarget > 0 ? (totalRevenue / revenueTarget) * 100 : 0;
  const activeTasks = tasks.filter((t) => t.status !== 'done').length;
  const convertedLeads = leads.filter((l) => l.status === 'converted').length;
  const conversionRate = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;
  const mrr = customers.reduce((sum, c) => sum + Number(c.lifetime_value), 0) / 12;
  const upcomingMilestones = milestones.filter((m) => m.status !== 'completed').slice(0, 5);

  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="Overview" description="Your business command center" />
        <EmptyState
          icon={Briefcase}
          title="No businesses yet"
          description="Start by creating your first business using the AI Business Planner. We'll help you turn your idea into an actionable plan."
          action={
            <Link to="/planner" className="btn-primary">
              <Sparkles className="w-4 h-4" />
              Create Your First Business
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Overview" description="Your business command center" />

      <CommandBar businesses={businesses} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Current Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} color="accent" />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={DollarSign} color="error" />
        <StatCard label="Revenue Target" value={formatCurrency(revenueTarget)} icon={Target} color="primary" />
        <StatCard
          label="Progress"
          value={formatPercent(progressPct)}
          icon={TrendingUp}
          color={progressPct >= 50 ? 'accent' : 'warning'}
        />
        <StatCard label="Active Tasks" value={activeTasks} icon={CheckSquare} color="primary" />
        <StatCard label="Leads" value={leads.length} icon={UserPlus} color="primary" />
        <StatCard label="Conversion Rate" value={formatPercent(conversionRate)} icon={TrendingUp} color="accent" />
        <StatCard label="Customers" value={customers.length} icon={Users2} color="primary" />
        <StatCard label="Est. MRR" value={formatCurrency(mrr)} icon={BarChart3} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Upcoming Milestones</h3>
            <Link to="/goals" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingMilestones.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No milestones yet. Generate a business plan to create them.</p>
          ) : (
            <div className="space-y-3">
              {upcomingMilestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${m.status === 'in_progress' ? 'bg-warning-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.title}</p>
                    <p className="text-xs text-slate-400">Day {m.target_day} · {m.status}</p>
                  </div>
                  <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {m.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">AI Recommendations</h3>
            <Link to="/notifications" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recommendations.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">
                AI recommendations will appear here once you have business data and agent runs to analyze.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-primary-50 dark:bg-primary-500/10">
                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400">{r.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{r.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Your Businesses</h3>
          <Link to="/businesses" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {businesses.slice(0, 5).map((b) => (
            <Link
              key={b.id}
              to="/businesses"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold">
                {b.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.name}</p>
                <p className="text-xs text-slate-400 truncate">Target: {formatCurrency(Number(b.revenue_target))} · {formatDate(b.target_deadline)}</p>
              </div>
              <span className={`badge ${b.status === 'active' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {b.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
