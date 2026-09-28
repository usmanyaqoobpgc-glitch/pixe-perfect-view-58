import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import type { Business } from '@/lib/types';

/** sessionStorage key AgentsPage reads on mount to auto-run a freshly submitted objective. */
export const PENDING_OBJECTIVE_KEY = 'pending_agent_objective';

const EXAMPLE_PROMPTS = [
  'Create my business marketing campaign',
  'Analyze my target customer and suggest 3 offers',
  'Build a 7-day social media content plan',
  'Suggest SEO actions for my website',
  'Create next tasks to hit my revenue target',
];

/**
 * A single "type anything" entry point for the Business Agent, meant to sit at the
 * top of the dashboard. It hands the objective + a target business off to the
 * existing /agents flow (Objective → Plan → Tasks → Specialist Agents → Execute → Results)
 * rather than re-implementing any of that logic here.
 */
export function CommandBar({ businesses }: { businesses: Business[] }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  if (businesses.length === 0) return null;

  function goRunObjective(objective: string, targetBusinessId: string) {
    setSubmitting(true);
    try {
      sessionStorage.setItem(
        PENDING_OBJECTIVE_KEY,
        JSON.stringify({ businessId: targetBusinessId, objective, ts: Date.now() }),
      );
    } catch {
      // sessionStorage can throw in locked-down environments (private browsing, etc.) —
      // the agents page still works, the objective just won't be pre-filled.
    }
    navigate({ to: '/agents' });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 8 || !businessId) return;
    goRunObjective(trimmed, businessId);
  }

  return (
    <div className="card p-5 mb-8 ring-1 ring-primary-500/10 dark:ring-primary-400/10">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-md bg-primary-500 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white text-sm leading-tight">Command your Business Agent</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            It plans the work, routes it to the right specialist agents, and runs it.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        {businesses.length > 1 && (
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="input sm:w-48 shrink-0"
            aria-label="Business"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='e.g. "Build my website" or "Run my social media for this week"'
          className="input flex-1"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={submitting || value.trim().length < 8 || !businessId}
          className="btn-primary shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Run
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setValue(p)}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/[0.2] transition"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
