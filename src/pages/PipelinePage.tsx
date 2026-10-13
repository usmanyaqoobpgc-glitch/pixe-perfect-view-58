import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { StatCard, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { UserPlus, Users2, Handshake, DollarSign, Download, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Lead, Customer, RevenueRecord } from '@/lib/types';

type Deal = RevenueRecord & { source_type?: string | null };

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacted: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  qualified: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
  converted: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400',
  lost: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400',
};

export function PipelinePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: biz, error: bErr } = await supabase.from('businesses').select('id').eq('user_id', user.id);
        if (bErr) throw bErr;
        const ids = (biz ?? []).map((b) => b.id);
        if (ids.length === 0) return;
        const [l, c, r] = await Promise.all([
          supabase.from('leads').select('*').in('business_id', ids).order('created_at', { ascending: false }),
          supabase.from('customers').select('*').in('business_id', ids).order('created_at', { ascending: false }),
          supabase.from('revenue_records').select('*').in('business_id', ids).eq('type', 'revenue').order('record_date', { ascending: false }),
        ]);
        if (l.error) throw l.error;
        setLeads((l.data ?? []) as Lead[]);
        setCustomers((c.data ?? []) as Customer[]);
        setDeals((r.data ?? []) as Deal[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load pipeline');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filteredLeads = useMemo(
    () => (stageFilter === 'all' ? leads : leads.filter((l) => l.status === stageFilter)),
    [leads, stageFilter]
  );

  const stats = useMemo(() => {
    const converted = leads.filter((l) => l.status === 'converted').length;
    const revenue = deals.reduce((s, d) => s + Number(d.amount), 0);
    const pipelineValue = leads
      .filter((l) => l.status !== 'lost' && l.status !== 'converted')
      .reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
    return { converted, revenue, pipelineValue };
  }, [leads, deals]);

  const exportCsv = () => {
    downloadCsv(
      'sales-pipeline.csv',
      ['Type', 'Name/Description', 'Email', 'Status/Type', 'Value ($)', 'Date'],
      [
        ...leads.map((l) => ['Lead', l.name, l.email ?? '', l.status, l.estimated_value ?? '', l.created_at.slice(0, 10)] as (string | number | null)[]),
        ...customers.map((c) => ['Customer', c.name, c.email ?? '', c.status, c.lifetime_value, c.created_at.slice(0, 10)]),
        ...deals.map((d) => ['Deal', d.description, '', d.source_type ?? 'manual', d.amount, d.record_date]),
      ]
    );
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        description="Leads, converted customers, deals and revenue in one place"
        action={
          <button onClick={exportCsv} className="btn-secondary" disabled={leads.length === 0 && customers.length === 0 && deals.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />
      {error && <div className="card p-4 mb-4 text-sm text-error-600">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Leads" value={leads.length} icon={UserPlus} color="primary" />
        <StatCard label="Converted" value={stats.converted} icon={Users2} color="accent" />
        <StatCard label="Deals" value={deals.length} icon={Handshake} color="primary" />
        <StatCard label="Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} color="accent" />
      </div>

      {leads.length === 0 && customers.length === 0 && deals.length === 0 ? (
        <EmptyState icon={Handshake} title="Pipeline is empty" description="Add leads and customers — won deals and revenue will appear here automatically." />
      ) : (
        <div className="space-y-6">
          {/* Leads by stage */}
          <div className="card p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Leads</h3>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="all">All stages</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            {filteredLeads.length === 0 ? (
              <p className="text-sm text-slate-400">No leads in this stage.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-2">Name</th><th>Source</th><th>Stage</th><th className="text-right">Est. value</th><th>Added</th></tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                      <td className="py-2 font-medium text-slate-900 dark:text-white">{l.name}</td>
                      <td className="capitalize">{l.source ?? '—'}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STAGE_COLORS[l.status] ?? STAGE_COLORS.new}`}>{l.status}</span>
                      </td>
                      <td className="text-right">{l.estimated_value != null ? formatCurrency(Number(l.estimated_value)) : '—'}</td>
                      <td>{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Converted customers */}
          <div className="card p-5 overflow-x-auto">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Converted customers</h3>
            {customers.length === 0 ? (
              <p className="text-sm text-slate-400">No customers yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-2">Name</th><th>Email</th><th>Status</th><th className="text-right">Lifetime value</th><th>Since</th></tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                      <td className="py-2 font-medium text-slate-900 dark:text-white">{c.name}</td>
                      <td>{c.email ?? '—'}</td>
                      <td className="capitalize">{c.status}</td>
                      <td className="text-right">{formatCurrency(Number(c.lifetime_value))}</td>
                      <td>{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Deals & revenue */}
          <div className="card p-5 overflow-x-auto">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Deals &amp; revenue</h3>
            {deals.length === 0 ? (
              <p className="text-sm text-slate-400">No deals recorded yet — convert a lead or add a customer with a value.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-2">Date</th><th>Description</th><th>Source</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                      <td className="py-2">{formatDate(d.record_date)}</td>
                      <td className="text-slate-900 dark:text-white">{d.description}</td>
                      <td className="capitalize">{d.source_type ?? 'manual'}</td>
                      <td className="text-right font-medium">{formatCurrency(Number(d.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
