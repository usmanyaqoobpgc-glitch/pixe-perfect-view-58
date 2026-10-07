import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { StatCard, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { DollarSign, TrendingUp, UserPlus, Users2, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RevenueRecord, Lead, Customer } from '@/lib/types';

type Row = RevenueRecord & { source_type?: string | null };

function monthKey(d: string) {
  return d.slice(0, 7);
}
function monthLabel(k: string) {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function RevenueHistoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Row[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: biz, error: bErr } = await supabase.from('businesses').select('id').eq('user_id', user.id);
        if (bErr) throw bErr;
        const ids = (biz ?? []).map((b) => b.id);
        if (ids.length === 0) return;
        const [r, l, c] = await Promise.all([
          supabase.from('revenue_records').select('*').in('business_id', ids).order('record_date', { ascending: false }),
          supabase.from('leads').select('*').in('business_id', ids),
          supabase.from('customers').select('*').in('business_id', ids),
        ]);
        if (r.error) throw r.error;
        setRecords((r.data ?? []) as Row[]);
        setLeads((l.data ?? []) as Lead[]);
        setCustomers((c.data ?? []) as Customer[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load revenue');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const months = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number; deals: number; leads: number; customers: number }>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { income: 0, expenses: 0, deals: 0, leads: 0, customers: 0 });
      return map.get(k)!;
    };
    records.forEach((r) => {
      const m = get(monthKey(r.record_date));
      if (r.type === 'revenue') { m.income += Number(r.amount); m.deals += 1; } else m.expenses += Number(r.amount);
    });
    leads.forEach((l) => { get(monthKey(l.created_at)).leads += 1; });
    customers.forEach((c) => { get(monthKey(c.created_at)).customers += 1; });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records, leads, customers]);

  if (loading) return <LoadingState />;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const cur = months.find(([k]) => k === thisMonth)?.[1];
  const totalIncome = records.filter((r) => r.type === 'revenue').reduce((s, r) => s + Number(r.amount), 0);
  const maxIncome = Math.max(1, ...months.map(([, v]) => v.income));

  return (
    <div>
      <PageHeader title="Revenue History" description="Monthly income and deals alongside your leads and customers" />
      {error && <div className="card p-4 mb-4 text-sm text-error-600">{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="This month" value={formatCurrency(cur?.income ?? 0)} icon={DollarSign} color="accent" />
        <StatCard label="All-time income" value={formatCurrency(totalIncome)} icon={TrendingUp} color="primary" />
        <StatCard label="Leads" value={leads.length} icon={UserPlus} color="primary" />
        <StatCard label="Customers" value={customers.length} icon={Users2} color="primary" />
      </div>

      {months.length === 0 ? (
        <EmptyState icon={Receipt} title="No revenue yet" description="Add a customer with a value or mark a lead converted — it will appear here automatically." />
      ) : (
        <>
          <div className="card p-5 mb-6 overflow-x-auto">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">By month</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="py-2">Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Deals</th><th>New leads</th><th>New customers</th></tr>
              </thead>
              <tbody>
                {months.map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100 dark:border-white/[0.06]">
                    <td className="py-2 font-medium text-slate-900 dark:text-white">{monthLabel(k)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded bg-accent-500" style={{ width: `${(v.income / maxIncome) * 80}px` }} />
                        {formatCurrency(v.income)}
                      </div>
                    </td>
                    <td>{formatCurrency(v.expenses)}</td>
                    <td>{formatCurrency(v.income - v.expenses)}</td>
                    <td>{v.deals}</td><td>{v.leads}</td><td>{v.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5 overflow-x-auto">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">All deals &amp; entries</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="py-2">Date</th><th>Description</th><th>Source</th><th>Type</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                    <td className="py-2">{formatDate(r.record_date)}</td>
                    <td className="text-slate-900 dark:text-white">{r.description}</td>
                    <td className="capitalize">{r.source_type ?? 'manual'}</td>
                    <td className="capitalize">{r.type}</td>
                    <td className="text-right font-medium">{formatCurrency(Number(r.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
