import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Megaphone, Sparkles, Plus, Trash2 } from 'lucide-react';
import type { Business, MarketingContent } from '@/lib/types';

export function MarketingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [items, setItems] = useState<MarketingContent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ channel: 'Social Media', content_type: 'Post', title: '', body: '' });

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
    supabase.from('marketing_content').select('*').eq('business_id', selectedBiz).order('created_at', { ascending: false }).then(({ data }) => setItems(data as MarketingContent[] ?? []));
  }, [selectedBiz]);

  const add = async () => {
    if (!newItem.title.trim()) return;
    const { data } = await supabase.from('marketing_content').insert({ business_id: selectedBiz, ...newItem, status: 'idea' }).select().single();
    if (data) setItems([data as MarketingContent, ...items]);
    setNewItem({ channel: 'Social Media', content_type: 'Post', title: '', body: '' });
    setShowAdd(false);
  };

  const remove = async (id: string) => {
    await supabase.from('marketing_content').delete().eq('id', id);
    setItems(items.filter((i) => i.id !== id));
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="Marketing" description="Plan and track your marketing content" /><EmptyState icon={Megaphone} title="No marketing yet" description="Create a business to start planning your marketing content." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  return (
    <div>
      <PageHeader title="Marketing" description="Plan and track your marketing content" action={<button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus className="w-4 h-4" /> Add Content</button>} />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>)}
      </div>

      {showAdd && (
        <div className="card p-5 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Channel</label><select className="input" value={newItem.channel} onChange={(e) => setNewItem({ ...newItem, channel: e.target.value })}><option>Social Media</option><option>Email</option><option>Blog</option><option>Paid Ads</option><option>Community</option></select></div>
            <div><label className="label">Type</label><select className="input" value={newItem.content_type} onChange={(e) => setNewItem({ ...newItem, content_type: e.target.value })}><option>Post</option><option>Article</option><option>Campaign</option><option>Video</option><option>Newsletter</option></select></div>
          </div>
          <div><label className="label">Title</label><input className="input" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} placeholder="Content title" /></div>
          <div><label className="label">Body</label><textarea className="input" value={newItem.body} onChange={(e) => setNewItem({ ...newItem, body: e.target.value })} placeholder="Content description or draft" /></div>
          <button onClick={add} className="btn-primary">Add</button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No marketing content yet" description="Add content ideas, or generate a plan to get AI-suggested marketing ideas." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-primary-100 dark:bg-primary-500/10 text-primary-600">{item.channel}</span>
                  <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500">{item.content_type}</span>
                  <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500">{item.status}</span>
                </div>
                <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
                {item.body && <p className="text-sm text-slate-500 mt-1">{item.body}</p>}
              </div>
              <button onClick={() => remove(item.id)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
