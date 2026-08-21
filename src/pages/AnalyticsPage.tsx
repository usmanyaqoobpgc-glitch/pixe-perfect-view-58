import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { BarChart3, Sparkles, Plus, Trash2, Download, AlertCircle } from 'lucide-react';
import type { Business, RevenueRecord } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

export function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RevenueRecord | null>(null);
  const [newRec, setNewRec] = useState({ type: 'revenue' as 'revenue' | 'expense', amount: '', description: '', category: '', is_estimate: false });

  async function load() {
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setBusinesses(data as Business[] ?? []);
    if (data && data.length > 0) setSelectedBiz(data[0].id);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!selectedBiz) return;
    supabase.from('revenue_records').select('*').eq('business_id', selectedBiz).order('record_date', { ascending: false }).then(({ data }) => setRecords(data as RevenueRecord[] ?? []));
  }, [selectedBiz]);

  const add = async () => {
    if (!newRec.amount || !newRec.description) return;
    const { data } = await supabase.from('revenue_records').insert({ business_id: selectedBiz, ...newRec, amount: Number(newRec.amount) }).select().single();
    if (data) setRecords([data as RevenueRecord, ...records]);
    setNewRec({ type: 'revenue', amount: '', description: '', category: '', is_estimate: false });
    setShowAdd(false);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await supabase.from('revenue_records').delete().eq('id', deleteTarget.id);
    setRecords(records.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Description', 'Category', 'Estimate'];
    const rows = records.map((r) => [r.record_date, r.type, r.amount, r.description, r.category ?? '', r.is_estimate ? 'Yes' : 'No']);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="Revenue & Analytics" description="Track real revenue, expenses, and profit" /><EmptyState icon={BarChart3} title="No analytics yet" description="Create a business to start tracking revenue and expenses." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  const totalRevenue = records.filter((r) => r.type === 'revenue').reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = records.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const profit = totalRevenue - totalExpenses;
  const hasEstimates = records.some((r) => r.is_estimate);

  return (
    <div>
      <PageHeader title="Revenue & Analytics" description="Track real revenue, expenses, and profit" action={
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={records.length === 0} className="btn-secondary"><Download className="w-4 h-4" /> Export CSV</button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus className="w-4 h-4" /> Add Record</button>
        </div>
      } />

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>)}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5"><p className="text-xs text-slate-400">Total Revenue</p><p className="text-2xl font-bold text-accent-600 mt-1">{formatCurrency(totalRevenue)}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-400">Total Expenses</p><p className="text-2xl font-bold text-error-600 mt-1">{formatCurrency(totalExpenses)}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-400">Profit</p><p className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-slate-900 dark:text-white' : 'text-error-600'}`}>{formatCurrency(profit)}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-400">Records</p><p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{records.length}</p></div>
      </div>

      {hasEstimates && (
        <div className="mb-4 p-3 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Some records are marked as AI estimates. These are not confirmed financial data.
        </div>
      )}

      {showAdd && (
        <div className="card p-5 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Type</label><select className="input" value={newRec.type} onChange={(e) => setNewRec({ ...newRec, type: e.target.value as 'revenue' | 'expense' })}><option value="revenue">Revenue</option><option value="expense">Expense</option></select></div>
            <div><label className="label">Amount ($)</label><input className="input" type="number" value={newRec.amount} onChange={(e) => setNewRec({ ...newRec, amount: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input" value={newRec.description} onChange={(e) => setNewRec({ ...newRec, description: e.target.value })} /></div>
            <div><label className="label">Category</label><input className="input" value={newRec.category} onChange={(e) => setNewRec({ ...newRec, category: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newRec.is_estimate} onChange={(e) => setNewRec({ ...newRec, is_estimate: e.target.checked })} /> Mark as AI estimate (not confirmed data)</label>
          <button onClick={add} className="btn-primary">Add Record</button>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState icon={BarChart3} title="No revenue records yet" description="Add your real revenue and expenses to track your business performance. Do not fabricate data." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-500">{r.record_date}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.type === 'revenue' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400'}`}>{r.type}{r.is_estimate && ' (est.)'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">{r.description}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(r.amount))}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setDeleteTarget(r)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Record" message="This will permanently remove this revenue/expense record. This cannot be undone." confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
