import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, CircleAlert, Clock3, ExternalLink, Loader2, Lock, Pause, Play, RefreshCw, Shield, Sparkles, XCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui";
import { Link } from "@tanstack/react-router";
import { planBusinessObjective, getAgentDashboard, executeAgentTask, approveAgentTask, cancelAgentTask, setBusinessAgentStatus } from "@/lib/agent.functions";
import type { Business } from "@/lib/types";

const SPECIALISTS = [
  ["market_research", "Market Research"], ["competitor", "Competitor"], ["business_strategy", "Strategy"],
  ["marketing", "Marketing"], ["sales", "Sales"], ["analytics", "Analytics"], ["optimization", "Optimization"],
  ["content", "Content"], ["social_media", "Social Media"], ["email_marketing", "Email Marketing"],
  ["website_seo", "Website & SEO"], ["finance", "Finance"], ["data_excel", "Data & Excel"], ["coding", "Coding"],
  ["design_creative", "Design & Creative"], ["document_pdf", "Document & PDF"], ["project_task", "Project & Tasks"], ["web_research", "Web Research"],
] as const;

function statusBadge(status: string) {
  if (status === "completed") return "bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400";
  if (status === "failed") return "bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400";
  if (status === "awaiting_approval") return "bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400";
  if (status === "running") return "bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function AgentsPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [objective, setObjective] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadBusinesses() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("businesses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const rows = (data ?? []) as Business[];
    setBusinesses(rows);
    if (!businessId && rows[0]) setBusinessId(rows[0].id);
    setLoading(false);
  }

  async function loadDashboard(id = businessId) {
    if (!id) return;
    try {
      setError("");
      const result = await getAgentDashboard({ data: { businessId: id } });
      setDashboard(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load agent dashboard."); }
  }

  useEffect(() => { void loadBusinesses(); }, [user]);
  useEffect(() => { if (businessId) void loadDashboard(); }, [businessId]);

  const tasks = dashboard?.tasks ?? [];
  const approvals = useMemo(() => tasks.filter((t: any) => t.status === "awaiting_approval"), [tasks]);
  const active = useMemo(() => tasks.filter((t: any) => ["pending", "running"].includes(t.status)), [tasks]);

  async function runObjective() {
    if (!businessId || objective.trim().length < 5) { setError("Enter a clear business objective first."); return; }
    setWorking(true); setError("");
    try {
      const planned = await planBusinessObjective({ data: { businessId, objective: objective.trim() } });
      setObjective("");
      // Automatically execute safe internal tasks. Approval-gated tasks remain waiting for the owner.
      const safeTasks = (planned.tasks ?? []).filter((t: any) => t.status === "pending" && !t.requires_approval).slice(0, 8);
      for (const task of safeTasks) {
        try { await executeAgentTask({ data: { taskId: task.id } }); }
        catch (e) { console.warn("Agent task failed", task.id, e); }
      }
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create the business plan."); }
    finally { setWorking(false); }
  }

  async function act(fn: () => Promise<unknown>, id: string) {
    setActionId(id); setError("");
    try { await fn(); await loadDashboard(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setActionId(null); }
  }

  async function toggleAgent() {
    if (!dashboard?.agent) return;
    await act(() => setBusinessAgentStatus({ data: { agentId: dashboard.agent.id, status: dashboard.agent.status === "active" ? "paused" : "active" } }), dashboard.agent.id);
  }

  if (loading) return <LoadingState />;
  if (!businesses.length) return <div><PageHeader title="AI Agents" description="Your AI business operating system" /><EmptyState icon={Bot} title="No business yet" description="Create a business first to activate your Business Agent." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="AI Agents" description="One Business Agent orchestrates specialist agents across your business." />

      {error && <div className="card p-4 border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-sm text-error-700 dark:text-error-300 flex gap-2"><CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

      <div className="card p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500">Business</label>
            <div className="relative mt-1">
              <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="input w-full appearance-none pr-9">
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select><ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500">What should your business AI do?</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void runObjective(); }} placeholder="e.g. Grow my clothing business and increase qualified leads" className="input mt-1 w-full" />
          </div>
          <button onClick={() => void runObjective()} disabled={working} className="btn-primary h-10 whitespace-nowrap">
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} {working ? "Planning..." : "Run Business Agent"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Server-side permissions</span>
          <span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> High-impact actions require approval</span>
          <span className="inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Duplicate execution protected</span>
        </div>
      </div>

      {dashboard && <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-slate-500">Agent</p><div className="mt-1 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dashboard.agent.status === "active" ? "bg-accent-500" : "bg-slate-400"}`} /><span className="font-semibold">{dashboard.agent.name}</span></div></div>
          <div className="card p-4"><p className="text-xs text-slate-500">Active tasks</p><p className="text-2xl font-bold mt-1">{active.length}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-500">Approvals</p><p className="text-2xl font-bold mt-1">{approvals.length}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-500">Completed</p><p className="text-2xl font-bold mt-1">{tasks.filter((t: any) => t.status === "completed").length}</p></div>
        </div>

        <div className="card p-5 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1"><p className="text-sm font-semibold">Business Agent</p><p className="text-xs text-slate-500 mt-1">{dashboard.agent.objective || "No objective set"}</p></div>
          <button onClick={() => void toggleAgent()} disabled={actionId === dashboard.agent.id} className="btn-secondary">
            {actionId === dashboard.agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : dashboard.agent.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {dashboard.agent.status === "active" ? "Pause Agent" : "Resume Agent"}
          </button>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Task Queue</h2><button className="btn-ghost" onClick={() => void loadDashboard()}><RefreshCw className="w-4 h-4" /> Refresh</button></div>
          <div className="space-y-3">
            {tasks.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">No agent tasks yet. Give the Business Agent an objective above.</div>}
            {tasks.map((task: any) => {
              const specialist = String(task.result?.agent_type ?? "project_task").replaceAll("_", " ");
              const busy = actionId === task.id;
              return <div key={task.id} className="card p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className={`badge ${statusBadge(task.status)}`}>{task.status.replaceAll("_", " ")}</span><span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500">{specialist}</span><span className="text-xs text-slate-400">{task.priority}</span></div><h3 className="font-medium mt-2">{task.title}</h3><p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p></div>
                  <div className="flex gap-2 shrink-0">
                    {task.status === "awaiting_approval" && <><button disabled={busy} onClick={() => void act(() => approveAgentTask({ data: { taskId: task.id, approve: true } }), task.id)} className="btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve</button><button disabled={busy} onClick={() => void act(() => approveAgentTask({ data: { taskId: task.id, approve: false } }), task.id)} className="btn-secondary"><XCircle className="w-4 h-4" /> Reject</button></>}
                    {task.status === "pending" && <button disabled={busy} onClick={() => void act(() => executeAgentTask({ data: { taskId: task.id } }), task.id)} className="btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Execute</button>}
                    {task.status === "pending" && <button disabled={busy} onClick={() => void act(() => cancelAgentTask({ data: { taskId: task.id } }), task.id)} className="btn-secondary"><XCircle className="w-4 h-4" /> Cancel</button>}
                  </div>
                </div>
                {task.status === "completed" && task.result && <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 text-sm"><p className="font-medium">Result</p><p className="text-slate-600 dark:text-slate-400 mt-1">{String(task.result.summary ?? "Completed")}</p>{Array.isArray(task.result.next_actions) && <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">{task.result.next_actions.slice(0, 5).map((x: unknown, i: number) => <li key={i}>{String(x)}</li>)}</ul>}</div>}
                {task.status === "failed" && <div className="mt-3 rounded-lg bg-error-50 dark:bg-error-500/10 p-3 text-xs text-error-700 dark:text-error-300">{task.error_message}</div>}
                <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-2"><Clock3 className="w-3 h-3" /> {new Date(task.created_at).toLocaleString()} {task.requires_approval && <><span>•</span><Lock className="w-3 h-3" /> approval protected</>}</div>
              </div>;
            })}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Specialist Agents</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {SPECIALISTS.map(([type, name]) => <div key={type} className="card p-3"><div className="flex items-center gap-2"><Bot className="w-4 h-4 text-primary-500" /><span className="text-sm font-medium">{name}</span></div><p className="text-[11px] text-slate-400 mt-1">Routed by Business Agent</p></div>)}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Recent Activity</h2>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {(dashboard.activity ?? []).slice(0, 15).map((a: any) => <div key={a.id} className="p-3 flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><ExternalLink className="w-3.5 h-3.5 text-slate-500" /></span><div className="flex-1"><p className="text-sm">{a.action.replaceAll("_", " ")}</p><p className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</p></div><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></div>)}
            {(!dashboard.activity || dashboard.activity.length === 0) && <div className="p-6 text-sm text-slate-500 text-center">Activity will appear here as the agent works.</div>}
          </div>
        </section>
      </>}
    </div>
  );
}
