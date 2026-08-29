import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { UserPlus, Sparkles, Plus, Trash2, Mail, Phone } from 'lucide-react';
import type { Business, Lead } from '@/lib/types';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export function LeadsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', source: '', estimated_value: '' });

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
    supabase.from('leads').select('*').eq('business_id', selectedBiz).order('created_at', { ascending: false }).then(({ data }) => setLeads(data as Lead[] ?? []));
  }, [selectedBiz]);

  const add = async () => {
    if (!newLead.name.trim()) return;
    const { data } = await supabase.from('leads').insert({ business_id: selectedBiz, ...newLead, estimated_value: newLead.estimated_value ? Number(newLead.estimated_value) : null, status: 'new' }).select().single();
    if (data) setLeads([data as Lead, ...leads]);
    setNewLead({ name: '', email: '', phone: '', source: '', estimated_value: '' });
    setShowAdd(false);
  };

  const updateStatus = async (lead: Lead, status: Lead['status']) => {
    await supabase.from('leads').update({ status }).eq('id', lead.id);
    setLeads(leads.map((l) => l.id === lead.id ? { ...l, status } : l));
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await supabase.from('leads').delete().eq('id', deleteTarget.id);
    setLeads(leads.filter((l) => l.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="Leads" description="Track and qualify your sales pipeline" /><EmptyState icon={UserPlus} title="No leads yet" description="Create a business to start tracking leads." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  return (
    <div>
      <PageHeader title="Leads" description="Track and qualify your sales pipeline" action={<button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus className="w-4 h-4" /> Add Lead</button>} />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>)}
      </div>

      {showAdd && (
        <div className="card p-5 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div><label className="label">Source</label><input className="input" value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} placeholder="Website, referral, etc." /></div>
            <div><label className="label">Email</label><input className="input" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
            <div><label className="label">Estimated Value ($)</label><input className="input" type="number" value={newLead.estimated_value} onChange={(e) => setNewLead({ ...newLead, estimated_value: e.target.value })} /></div>
          </div>
          <button onClick={add} className="btn-primary">Add Lead</button>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState icon={UserPlus} title="No leads yet" description="Add leads manually or generate a plan to get lead generation strategies." />
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="card p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium shrink-0">{lead.name[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{lead.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>}
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                  {lead.source && <span>· {lead.source}</span>}
                </div>
              </div>
              <select value={lead.status} onChange={(e) => updateStatus(lead, e.target.value as Lead['status'])} className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setDeleteTarget(lead)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Lead" message="This will permanently remove this lead. This cannot be undone." confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
