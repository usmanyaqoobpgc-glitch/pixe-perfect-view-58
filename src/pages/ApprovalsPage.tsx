import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { PageHeader, EmptyState, LoadingState } from '@/components/ui';
import { getPendingApprovals } from '@/lib/agent.functions';
import { approveAgentTask } from '@/lib/agent.functions';
import { ShieldCheck, Check, X, ArrowRight, Loader2 } from 'lucide-react';

interface PendingApproval {
  id: string;
  business_id: string;
  business_name: string;
  title: string;
  description: string | null;
  task_type: string;
  assigned_agent_type: string | null;
  priority: string;
  approval_reason: string | null;
  created_at: string;
}

/**
 * Cross-business view of every task currently awaiting_approval, so the founder
 * doesn't have to open each business's AI Agents page individually to find
 * external/irreversible actions that need a human decision. Reuses the exact
 * same approve/reject server function AgentsPage uses per-task — no new
 * approval logic, just a different (aggregated) place to see and act on it.
 */
export function ApprovalsPage() {
  const loadApprovals = useServerFn(getPendingApprovals);
  const decideTask = useServerFn(approveAgentTask);

  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = (await loadApprovals()) as PendingApproval[];
      setApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, [loadApprovals]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function decide(taskId: string, approve: boolean) {
    setBusyId(taskId);
    setError(null);
    try {
      await decideTask({ data: { taskId, approve } });
      setApprovals((prev) => prev.filter((a) => a.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record your decision.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Pending Approvals"
        description="External or irreversible actions your specialist agents flagged for your review, across every business."
      />

      {error && (
        <div className="rounded-lg bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-400 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {approvals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing waiting on you"
          description="When a specialist agent proposes an action like sending a message, publishing content, or spending money, it will show up here until you approve or reject it."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      to="/agents"
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {a.business_name}
                    </Link>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                      {a.assigned_agent_type?.replace(/_/g, ' ') ?? 'Business Agent'}
                    </span>
                    <span
                      className={`badge ${
                        a.priority === 'urgent' || a.priority === 'high'
                          ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      } capitalize`}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{a.title}</p>
                  {a.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{a.description}</p>}
                  {a.approval_reason && (
                    <p className="text-xs text-warning-700 dark:text-warning-400 mt-2 bg-warning-50 dark:bg-warning-500/10 rounded px-2 py-1.5 inline-block">
                      Needs approval: {a.approval_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => decide(a.id, false)}
                    disabled={busyId === a.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                  <button
                    onClick={() => decide(a.id, true)}
                    disabled={busyId === a.id}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                </div>
              </div>
              <Link
                to="/agents"
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                View in AI Agents <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
