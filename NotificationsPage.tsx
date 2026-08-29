import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { LoadingState, PageHeader, EmptyState } from '@/components/ui';
import { Bell, Check, Trash2 } from 'lucide-react';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';

export function NotificationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setNotifications(data as Notification[] ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  };

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  if (loading) return <LoadingState />;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <PageHeader title="Notifications" description={`${unread} unread`} action={unread > 0 ? <button onClick={markAllRead} className="btn-secondary"><Check className="w-4 h-4" /> Mark all read</button> : undefined} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You'll see AI recommendations, milestone updates, and security alerts here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`card p-4 flex items-start gap-3 ${!n.is_read ? 'border-primary-200 dark:border-primary-500/30' : ''}`}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-primary-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                  <span className={`badge ${n.type === 'ai' ? 'bg-primary-100 dark:bg-primary-500/10 text-primary-600' : n.type === 'warning' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400' : n.type === 'error' ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{n.type}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(n.created_at)}</p>
              </div>
              <div className="flex gap-1">
                {!n.is_read && <button onClick={() => markRead(n.id)} className="btn-ghost"><Check className="w-4 h-4" /></button>}
                <button onClick={() => remove(n.id)} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
