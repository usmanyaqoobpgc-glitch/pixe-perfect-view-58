import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  getAgentDashboard,
  planBusinessObjective,
  executeAgentTask,
  approveAgentTask,
  cancelAgentTask,
  setBusinessAgentStatus,
} from '@/lib/agent.functions';
import {
  Bot, Sparkles, Search, Users, Target, Megaphone, UserPlus, BarChart3, Zap, Shield, Lock,
  Play, Pause, RefreshCw, Check, X, ChevronDown, ChevronUp, AlertTriangle, Loader2, Activity,
  PenTool, TrendingUp, Share2, Code, DollarSign, Briefcase, Headphones, Palette, Table, ClipboardList, GraduationCap,
  ExternalLink, Download,
} from 'lucide-react';
import type { Business } from '@/lib/types';
import { PENDING_OBJECTIVE_KEY } from '@/components/CommandBar';

const AGENTS = [
  { type: 'market_research', name: 'Market Research Agent', icon: Search, description: 'Researches and summarizes market opportunities for your business idea.', permissions: ['Read: business data', 'Read: market context'] },
  { type: 'competitor', name: 'Competitor Agent', icon: Users, description: 'Identifies competitors and compares pricing, features, positioning, strengths, and weaknesses.', permissions: ['Read: business data', 'Read: competitor context'] },
  { type: 'business_strategy', name: 'Business Strategy Agent', icon: Target, description: 'Creates practical business strategies based on your goals and constraints.', permissions: ['Read: business data', 'Write: plan sections'] },
  { type: 'marketing', name: 'Marketing Agent', icon: Megaphone, description: 'Generates campaigns, content plans, and social media strategies.', permissions: ['Read: business data', 'Write: marketing content'] },
  { type: 'sales', name: 'Sales Agent', icon: UserPlus, description: 'Helps qualify leads and generate customer communication templates.', permissions: ['Read: leads', 'Read: customers', 'Write: templates'] },
  { type: 'analytics', name: 'Analytics Agent', icon: BarChart3, description: 'Analyzes business metrics and recommends actions based on actual results.', permissions: ['Read: revenue records', 'Read: leads', 'Read: customers'] },
  { type: 'optimization', name: 'Optimization Agent', icon: Zap, description: 'Compares goals versus actual performance and suggests adjustments.', permissions: ['Read: milestones', 'Read: tasks', 'Read: revenue'] },
  { type: 'content_writing', name: 'Content Writing Agent', icon: PenTool, description: 'Drafts blog posts, product copy, landing page copy and long-form content.', permissions: ['Read: business data', 'Write: content drafts'] },
  { type: 'seo', name: 'SEO Agent', icon: TrendingUp, description: 'Produces keyword research, on-page SEO recommendations and technical SEO checklists.', permissions: ['Read: business data', 'Write: SEO recommendations'] },
  { type: 'social_media', name: 'Social Media Agent', icon: Share2, description: 'Drafts social post ideas, captions, hashtags and content calendars.', permissions: ['Read: business data', 'Write: social content drafts'] },
  { type: 'coding', name: 'Coding Agent', icon: Code, description: 'Produces technical specs, code snippets and implementation plans for apps and websites.', permissions: ['Read: business data', 'Write: technical plans'] },
  { type: 'finance', name: 'Finance Agent', icon: DollarSign, description: 'Builds budgets, cash-flow projections, pricing math and financial summaries.', permissions: ['Read: revenue records', 'Write: financial plans'] },
  { type: 'hr_recruitment', name: 'HR & Recruitment Agent', icon: Briefcase, description: 'Drafts job descriptions, interview questions and hiring/onboarding plans.', permissions: ['Read: business data', 'Write: HR drafts'] },
  { type: 'customer_support', name: 'Customer Support Agent', icon: Headphones, description: 'Drafts support reply templates, FAQ content and escalation guidelines.', permissions: ['Read: leads', 'Read: customers', 'Write: support templates'] },
  { type: 'design', name: 'Design Agent', icon: Palette, description: 'Produces design briefs and creative direction for pages, brand and UI.', permissions: ['Read: business data', 'Write: design briefs'] },
  { type: 'data_excel', name: 'Data & Excel Agent', icon: Table, description: 'Designs spreadsheet structures, formulas and reporting layouts from your real numbers.', permissions: ['Read: revenue records', 'Write: data models'] },
  { type: 'project_management', name: 'Project Management Agent', icon: ClipboardList, description: 'Breaks objectives into milestones, task breakdowns and sequencing.', permissions: ['Read: milestones', 'Read: tasks', 'Write: project plans'] },
  { type: 'education', name: 'Education & Learning Agent', icon: GraduationCap, description: 'Designs curricula, course outlines, lesson plans and assessments.', permissions: ['Read: business data', 'Write: learning plans'] },
] as const;

const AGENT_NAMES: Record<string, string> = {
  business: 'Business Agent',
  ...Object.fromEntries(AGENTS.map((a) => [a.type, a.name])),
};

const AGENT_RESTRICTIONS = [
  'Cannot change account ownership',
  'Cannot change subscription prices',
  "Cannot access another user's data",
  'Cannot reveal system secrets',
  'Cannot retrieve API keys',
  'Cannot disable security controls',
  'Cannot execute arbitrary server commands',
  'Cannot make financial transactions without explicit authorization',
];

interface AgentTask {
  id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  assigned_agent_type: string | null;
  status: string;
  priority: string;
  requires_approval: boolean;
  approval_reason: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  status: string;
  task_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Dashboard {
  agent: { id: string; name: string; status: string; objective: string | null; last_error: string | null; last_activity_at: string | null };
  business: { id: string; name: string };
  tasks: AgentTask[];
  activity: ActivityEntry[];
  counts: Record<string, number>;
  specialistRuns: Record<string, number>;
  aiConfigured: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  awaiting_approval: 'Needs approval',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
    running: 'bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400',
    completed: 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400',
    failed: 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400',
    cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-400',
    awaiting_approval: 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
  };
  return (
    <span className={`badge ${map[status] ?? map['pending']} inline-flex items-center gap-1`}>
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ResultPanel({ task }: { task: AgentTask }) {
  const [open, setOpen] = useState(false);
  const result = task.result ?? {};
  const summary = typeof result['summary'] === 'string' ? result['summary'] : '';
  const deliverable = typeof result['deliverable'] === 'string' ? result['deliverable'] : '';
  const keyPoints = Array.isArray(result['key_points']) ? (result['key_points'] as unknown[]).map(String) : [];
  const nextActions = Array.isArray(result['next_actions']) ? (result['next_actions'] as unknown[]).map(String) : [];
  const generatedHtml = typeof result['generated_html'] === 'string' ? result['generated_html'] : '';
  const generatedHtmlKind = result['generated_html_kind'] === 'document' ? 'document' : 'website';
  const calendarPosts = Array.isArray(result['calendar_posts'])
    ? (result['calendar_posts'] as unknown[]).filter(
        (p): p is { id: string; channel: string; title: string; body: string; hashtags: string[]; scheduled_date: string | null } =>
          typeof p === 'object' && p !== null,
      )
    : [];
  if (!summary && !deliverable) return null;

  function openPreview() {
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function downloadHtml() {
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || generatedHtmlKind}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400">
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? 'Hide result' : 'View result'}
      </button>
      {!open && summary && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">{summary}</p>}
      {open && (
        <div className="mt-2 space-y-3">
          {summary && <p className="text-sm text-slate-600 dark:text-slate-300">{summary}</p>}
          {generatedHtml && (
            <div>
              <div className="flex items-center gap-2">
                <button onClick={openPreview} className="btn-primary text-xs px-3 py-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {generatedHtmlKind === 'document' ? 'Preview document' : 'Preview website'}
                </button>
                <button onClick={downloadHtml} className="btn-secondary text-xs px-3 py-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Download HTML
                </button>
              </div>
              {generatedHtmlKind === 'document' && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Tip: after previewing, use your browser's Print (Ctrl/Cmd+P) and choose "Save as PDF" to get a PDF file.
                </p>
              )}
            </div>
          )}
          {calendarPosts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                {calendarPosts.length} posts saved to your content calendar
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...calendarPosts]
                  .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
                  .map((p) => (
                    <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="badge bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 capitalize">
                          {p.channel}
                        </span>
                        <span className="text-[11px] text-slate-400">{p.scheduled_date}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-900 dark:text-white mb-1">{p.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">{p.body}</p>
                      {p.hashtags?.length > 0 && (
                        <p className="text-[11px] text-primary-500 mt-1.5 line-clamp-1">
                          {p.hashtags.map((h) => `#${h}`).join(' ')}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
          {keyPoints.length > 0 && (
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              {keyPoints.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          )}
          {deliverable && (
            <pre className="text-xs whitespace-pre-wrap font-sans bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-slate-700 dark:text-slate-300 max-h-80 overflow-y-auto">
              {deliverable}
            </pre>
          )}
          {nextActions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Next actions</p>
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                {nextActions.map((p, i) => <li key={i}>{i + 1}. {p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentsPage() {
  const { user } = useAuth();
  const loadDashboard = useServerFn(getAgentDashboard);
  const runObjective = useServerFn(planBusinessObjective);
  const runTask = useServerFn(executeAgentTask);
  const decideTask = useServerFn(approveAgentTask);
  const stopTask = useServerFn(cancelAgentTask);
  const setStatus = useServerFn(setBusinessAgentStatus);

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<string>('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [objective, setObjective] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const executingRef = useRef(false);
  const pendingObjectiveRef = useRef(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const list = (data as Business[]) ?? [];
      setBusinesses(list);

      // Pick up an objective handed off from the dashboard's Command Bar, if any.
      let pendingId: string | null = null;
      let pendingObjective: string | null = null;
      try {
        const raw = sessionStorage.getItem(PENDING_OBJECTIVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { businessId?: string; objective?: string; ts?: number };
          // Ignore stale entries (older than 2 minutes) so a forgotten tab doesn't re-run later.
          if (parsed.objective && parsed.businessId && parsed.ts && Date.now() - parsed.ts < 120_000) {
            if (list.some((b) => b.id === parsed.businessId)) {
              pendingId = parsed.businessId;
              pendingObjective = parsed.objective;
            }
          }
          sessionStorage.removeItem(PENDING_OBJECTIVE_KEY);
        }
      } catch {
        // sessionStorage may be unavailable — just fall back to normal behavior.
      }

      if (pendingId && pendingObjective) {
        setBusinessId(pendingId);
        setObjective(pendingObjective);
        pendingObjectiveRef.current = true;
      } else if (list.length > 0 && list[0]) {
        setBusinessId(list[0].id);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const refresh = useCallback(
    async (id: string) => {
      try {
        const data = (await loadDashboard({ data: { businessId: id } })) as Dashboard;
        setDashboard(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the agent.');
        return null;
      }
    },
    [loadDashboard],
  );

  useEffect(() => {
    if (!businessId) return;
    setDashboard(null);
    refresh(businessId);
  }, [businessId, refresh]);

  /** Sequentially execute queued steps — one runner at a time. */
  const drainQueue = useCallback(
    async (id: string) => {
      if (executingRef.current) return;
      executingRef.current = true;
      try {
        for (let i = 0; i < 8; i++) {
          const data = await refresh(id);
          if (!data || data.agent.status !== 'active') break;
          const next = data.tasks
            .filter((t) => t.task_type === 'specialist' && t.status === 'pending')
            .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
          if (!next) break;
          setBusyTaskId(next.id);
          try {
            await runTask({ data: { taskId: next.id } });
          } catch {
            /* failure is recorded on the task itself */
          }
          setBusyTaskId(null);
        }
      } finally {
        executingRef.current = false;
        await refresh(id);
      }
    },
    [refresh, runTask],
  );

  // Light polling only while something is in flight.
  useEffect(() => {
    if (!businessId || !dashboard) return;
    const active = dashboard.tasks.some((t) => t.status === 'running' || t.status === 'pending');
    if (!active) return;
    const timer = setInterval(() => refresh(businessId), 5000);
    return () => clearInterval(timer);
  }, [businessId, dashboard, refresh]);

  async function handleRunObjective() {
    if (starting || !businessId || objective.trim().length < 8) return;
    setStarting(true);
    setError(null);
    try {
      await runObjective({ data: { businessId, objective: objective.trim() } });
      setObjective('');
      await drainQueue(businessId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start this objective.');
      await refresh(businessId);
    } finally {
      setStarting(false);
    }
  }

  // Auto-run an objective handed off from the dashboard's Command Bar, once the
  // matching business is selected and its dashboard has loaded.
  useEffect(() => {
    if (!pendingObjectiveRef.current) return;
    if (!businessId || !dashboard || starting) return;
    pendingObjectiveRef.current = false;
    handleRunObjective();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, dashboard]);

  async function withTask(taskId: string, fn: () => Promise<unknown>) {
    setBusyTaskId(taskId);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action could not be completed.');
    } finally {
      setBusyTaskId(null);
      if (businessId) await refresh(businessId);
    }
  }

  async function toggleAgent() {
    if (!dashboard) return;
    const next = dashboard.agent.status === 'active' ? 'paused' : 'active';
    setError(null);
    try {
      await setStatus({ data: { agentId: dashboard.agent.id, status: next } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change the agent status.');
    }
    await refresh(businessId);
  }

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="AI Agents" description="Modular AI agents with scoped permissions" />
        <EmptyState
          icon={Bot}
          title="No agents available yet"
          description="Create a business to start using AI agents."
          action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>}
        />
      </div>
    );
  }

  const objectives = (dashboard?.tasks ?? []).filter((t) => t.task_type === 'objective');
  const stepsOf = (parentId: string) =>
    (dashboard?.tasks ?? [])
      .filter((t) => t.parent_task_id === parentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="The Business Agent turns an objective into an execution plan and runs your specialist agents"
        action={
          businesses.length > 1 ? (
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="input max-w-xs">
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : undefined
        }
      />

      {/* Business Agent control panel */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {dashboard?.agent.name ?? 'Business Agent'}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {dashboard?.business.name ?? businesses.find((b) => b.id === businessId)?.name}
              {dashboard?.agent.objective ? ` • ${dashboard.agent.objective}` : ''}
            </p>
          </div>
          {dashboard && <StatusBadge status={dashboard.agent.status === 'active' ? 'completed' : 'cancelled'} />}
          {dashboard && (
            <button onClick={toggleAgent} className="btn-secondary">
              {dashboard.agent.status === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
            </button>
          )}
        </div>

        <label htmlFor="objective" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          New objective
        </label>
        <textarea
          id="objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          placeholder="Enter business objective..."
          className="input w-full resize-none"
          disabled={starting}
        />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button onClick={handleRunObjective} disabled={starting || objective.trim().length < 8} className="btn-primary">
            {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Running objective...</> : <><Play className="w-4 h-4" /> Run Objective</>}
          </button>
          <button onClick={() => refresh(businessId)} className="btn-ghost">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {dashboard && !dashboard.aiConfigured && (
            <span className="text-xs text-warning-600">AI provider not configured — placeholder results will be produced.</span>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-error-600 bg-error-50 dark:bg-error-500/10 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {dashboard?.agent.last_error && !error && (
          <p className="mt-3 text-xs text-error-600">Last agent error: {dashboard.agent.last_error}</p>
        )}
      </div>

      {/* Execution status */}
      {!dashboard && <LoadingState label="Loading agent workspace..." />}



      {dashboard && objectives.length === 0 && (
        <EmptyState
          icon={Bot}
          title="No objectives yet"
          description="Enter an objective above and the Business Agent will build an execution plan and run your specialist agents."
        />
      )}

      {dashboard && objectives.length > 0 && (
        <div className="space-y-4 mb-8">
          {objectives.map((obj) => {
            const steps = stepsOf(obj.id);
            const planSummary = typeof obj.result?.['plan_summary'] === 'string' ? (obj.result['plan_summary'] as string) : '';
            return (
              <div key={obj.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-3 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{obj.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Business Agent • {new Date(obj.created_at).toLocaleString()} • {steps.length} steps
                    </p>
                  </div>
                  <StatusBadge status={obj.status} />
                  {['pending', 'awaiting_approval'].includes(obj.status) && (
                    <button onClick={() => withTask(obj.id, () => stopTask({ data: { taskId: obj.id } }))} className="btn-ghost" disabled={busyTaskId === obj.id}>
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  )}
                </div>
                {planSummary && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{planSummary}</p>}
                {obj.error_message && <p className="text-xs text-error-600 mb-3">{obj.error_message}</p>}

                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={step.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400 w-5 shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{step.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {AGENT_NAMES[step.assigned_agent_type ?? ''] ?? 'Specialist Agent'} • {step.priority}
                          </p>
                        </div>
                        <StatusBadge status={step.status} />
                        {step.status === 'awaiting_approval' && (
                          <>
                            <button onClick={() => withTask(step.id, async () => { await decideTask({ data: { taskId: step.id, approve: true } }); await drainQueue(businessId); })} className="btn-primary" disabled={busyTaskId === step.id}>
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button onClick={() => withTask(step.id, () => decideTask({ data: { taskId: step.id, approve: false } }))} className="btn-secondary" disabled={busyTaskId === step.id}>
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </>
                        )}
                        {step.status === 'failed' && (
                          <button onClick={() => withTask(step.id, () => runTask({ data: { taskId: step.id } }))} className="btn-secondary" disabled={busyTaskId === step.id}>
                            <RefreshCw className="w-4 h-4" /> Retry
                          </button>
                        )}
                        {step.status === 'pending' && (
                          <button onClick={() => withTask(step.id, () => runTask({ data: { taskId: step.id } }))} className="btn-secondary" disabled={busyTaskId === step.id}>
                            <Play className="w-4 h-4" /> Run
                          </button>
                        )}
                      </div>
                      {step.approval_reason && step.status === 'awaiting_approval' && (
                        <p className="text-xs text-warning-600 mt-2">{step.approval_reason}</p>
                      )}
                      {step.error_message && <p className="text-xs text-error-600 mt-2">{step.error_message}</p>}
                      <ResultPanel task={step} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity log */}
      {dashboard && dashboard.activity.length > 0 && (
        <div className="mb-8">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-3">
            <Activity className="w-4 h-4 text-slate-400" /> Agent Activity
          </h3>
          <div className="card divide-y divide-slate-200 dark:divide-slate-800">
            {dashboard.activity.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <StatusBadge status={a.status} />
                <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{a.action.replace(/_/g, ' ')}</span>
                {typeof a.metadata?.['agent_type'] === 'string' && (
                  <span className="text-xs text-slate-400">{AGENT_NAMES[a.metadata['agent_type'] as string] ?? a.metadata['agent_type']}</span>
                )}
                <span className="text-xs text-slate-400 ml-auto">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specialist agents + security notice */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const runCount = dashboard?.specialistRuns[agent.type] ?? 0;
          return (
            <div key={agent.type} className="card p-5 hover:shadow-md transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{runCount} runs</p>
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
    </div>
  );
}
