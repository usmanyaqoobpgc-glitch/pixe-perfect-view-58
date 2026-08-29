import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Users2, Sparkles, Plus, Trash2, Mail, Phone } from 'lucide-react';
import type { Business, Customer } from '@/lib/types';

export function CustomersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', notes: '', lifetime_value: '' });

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
    supabase.from('customers').select('*').eq('business_id', selectedBiz).order('created_at', { ascending: false }).then(({ data }) => setCustomers(data as Customer[] ?? []));
  }, [selectedBiz]);

  const add = async () => {
    if (!newCust.name.trim()) return;
    const { data } = await supabase.from('customers').insert({ business_id: selectedBiz, ...newCust, lifetime_value: newCust.lifetime_value ? Number(newCust.lifetime_value) : 0, status: 'active' }).select().single();
    if (data) setCustomers([data as Customer, ...customers]);
    setNewCust({ name: '', email: '', phone: '', notes: '', lifetime_value: '' });
    setShowAdd(false);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await supabase.from('customers').delete().eq('id', deleteTarget.id);
    setCustomers(customers.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="Customers" description="Manage your customer relationships" /><EmptyState icon={Users2} title="No customers yet" description="Create a business to start tracking customers." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  return (
    <div>
      <PageHeader title="Customers" description="Manage your customer relationships" action={<button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus className="w-4 h-4" /> Add Customer</button>} />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>)}
      </div>

      {showAdd && (
        <div className="card p-5 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></div>
            <div><label className="label">Lifetime Value ($)</label><input className="input" type="number" value={newCust.lifetime_value} onChange={(e) => setNewCust({ ...newCust, lifetime_value: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" value={newCust.notes} onChange={(e) => setNewCust({ ...newCust, notes: e.target.value })} /></div>
          <button onClick={add} className="btn-primary">Add Customer</button>
        </div>
      )}

      {customers.length === 0 ? (
        <EmptyState icon={Users2} title="No customers yet" description="Add customers manually as you convert leads." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="card p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-primary-500 text-white flex items-center justify-center text-sm font-medium shrink-0">{c.name[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">LTV: ${Number(c.lifetime_value).toLocaleString()} · <span className="capitalize">{c.status}</span></p>
              </div>
              <button onClick={() => setDeleteTarget(c)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Customer" message="This will permanently remove this customer record. This cannot be undone." confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
