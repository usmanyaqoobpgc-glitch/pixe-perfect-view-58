import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { CheckSquare, Sparkles, Plus, Trash2, Check } from 'lucide-react';
import type { Business, Task } from '@/lib/types';

export function TasksPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Task['priority'] });

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
    supabase.from('tasks').select('*').eq('business_id', selectedBiz).order('created_at', { ascending: false }).then(({ data }) => setTasks(data as Task[] ?? []));
  }, [selectedBiz]);

  const add = async () => {
    if (!newTask.title.trim()) return;
    const { data } = await supabase.from('tasks').insert({ business_id: selectedBiz, ...newTask, status: 'todo' }).select().single();
    if (data) setTasks([data as Task, ...tasks]);
    setNewTask({ title: '', description: '', priority: 'medium' });
    setShowAdd(false);
  };

  const toggle = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await supabase.from('tasks').update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }).eq('id', task.id);
    setTasks(tasks.map((t) => t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : t));
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await supabase.from('tasks').delete().eq('id', deleteTarget.id);
    setTasks(tasks.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return <div><PageHeader title="Tasks" description="Track your daily and weekly tasks" /><EmptyState icon={CheckSquare} title="No tasks yet" description="Create a business and generate a plan to get AI-suggested tasks." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} /></div>;
  }

  const active = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div>
      <PageHeader title="Tasks" description="Track your daily and weekly tasks" action={<button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus className="w-4 h-4" /> Add Task</button>} />
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>)}
      </div>

      {showAdd && (
        <div className="card p-5 mb-4 space-y-3 animate-fade-in">
          <div><label className="label">Title</label><input className="input" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} /></div>
          <div><label className="label">Priority</label><select className="input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
          <button onClick={add} className="btn-primary">Add Task</button>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" description="Generate a business plan to get AI-suggested tasks, or add your own." />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">Active ({active.length})</h3>
            <div className="space-y-2">
              {active.map((t) => (
                <div key={t.id} className="card p-3 flex items-center gap-3">
                  <button onClick={() => toggle(t)} className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-primary-500 transition shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                  </div>
                  <span className={`badge ${t.priority === 'urgent' ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400' : t.priority === 'high' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{t.priority}</span>
                  <button onClick={() => setDeleteTarget(t)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          {done.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">Completed ({done.length})</h3>
              <div className="space-y-2">
                {done.map((t) => (
                  <div key={t.id} className="card p-3 flex items-center gap-3 opacity-60">
                    <button onClick={() => toggle(t)} className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></button>
                    <p className="text-sm font-medium line-through text-slate-400 flex-1">{t.title}</p>
                    <button onClick={() => setDeleteTarget(t)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Task" message="This will permanently remove this task. This cannot be undone." confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
