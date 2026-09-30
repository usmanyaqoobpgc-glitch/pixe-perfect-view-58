import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import {
  ShieldCheck, Users, ScrollText, Search, ShieldAlert, CheckCircle2, Database,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';

interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  mfa_enabled: boolean;
  created_at: string;
  business_count: number;
}

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  event_description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type Tab = 'users' | 'audit' | 'data';

const DATA_TABLES = [
  'businesses', 'leads', 'customers', 'revenue_records', 'business_plans', 'milestones',
  'tasks', 'marketing_content', 'website_drafts', 'business_agents', 'agent_tasks',
  'agent_activity_log', 'ai_agent_runs', 'notifications',
] as const;

export function AdminPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; email: string; newRole: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [dataUserId, setDataUserId] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const isAdmin = profile?.role === 'admin';

  const loadCounts = useCallback(async (userId: string) => {
    const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', userId);
    const bizIds = (biz ?? []).map((b) => b.id);
    const byBusiness = async (t: 'leads' | 'customers' | 'revenue_records' | 'business_plans' | 'milestones' | 'tasks' | 'marketing_content' | 'website_drafts') => {
      if (bizIds.length === 0) return 0;
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true }).in('business_id', bizIds);
      return error ? null : count ?? 0;
    };
    const byUser = async (t: 'business_agents' | 'agent_tasks' | 'agent_activity_log' | 'ai_agent_runs' | 'notifications') => {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('user_id', userId);
      return error ? null : count ?? 0;
    };
    const result: Record<string, number | null> = { businesses: bizIds.length };
    await Promise.all([
      ...(['leads', 'customers', 'revenue_records', 'business_plans', 'milestones', 'tasks', 'marketing_content', 'website_drafts'] as const).map(
        async (t) => { result[t] = await byBusiness(t); },
      ),
      ...(['business_agents', 'agent_tasks', 'agent_activity_log', 'ai_agent_runs', 'notifications'] as const).map(
        async (t) => { result[t] = await byUser(t); },
      ),
    ]);
    setCounts(result);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc('staff_list_users');
    if (error) {
      setActionError(error.message);
      return;
    }
    setUsers(data as StaffUser[]);
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_audit_logs', { p_limit: 100 });
    if (error) {
      setActionError(error.message);
      return;
    }
    setAuditLogs(data as AuditLogEntry[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      setLoading(true);
      setActionError(null);
      if (tab === 'users' || tab === 'data') {
        await loadUsers();
      } else {
        await loadAuditLogs();
      }
      setLoading(false);
    }
    load();
  }, [tab, isAdmin, loadUsers, loadAuditLogs]);

  const handleRoleChange = async () => {
    if (!roleConfirm) return;
    setActionError(null);
    setActionSuccess(null);
    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: roleConfirm.userId,
      p_role: roleConfirm.newRole,
    });
    if (error) {
      setActionError(error.message);
    } else {
      setActionSuccess(`Updated ${roleConfirm.email} to ${roleConfirm.newRole}`);
      await loadUsers();
    }
    setRoleConfirm(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (profile && !isAdmin) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        Access denied. This page is for administrators only.
      </div>
    );
  }
  if (loading || !profile) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Admin Panel" description="Manage users, roles, and audit logs" />

      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-600 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6 max-w-md">
        <button
          onClick={() => setTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${tab === 'users' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
        >
          <Users className="w-4 h-4" /> Users
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${tab === 'audit' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
        >
          <ScrollText className="w-4 h-4" /> Audit Log
        </button>
        <button
          onClick={() => setTab('data')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${tab === 'data' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
        >
          <Database className="w-4 h-4" /> User Data
        </button>
      </div>

      {tab === 'data' && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">User Data (admin only)</h3>
          <select
            value={dataUserId}
            onChange={(e) => { setDataUserId(e.target.value); if (e.target.value) void loadCounts(e.target.value); }}
            className="input text-sm max-w-sm mb-4"
          >
            <option value="">Select a user...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
            ))}
          </select>
          {dataUserId && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DATA_TABLES.map((t) => (
                <div key={t} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-400">{t.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{counts[t] ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">All Users</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-sm max-w-[240px]"
                placeholder="Search users..."
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-400">
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">MFA</th>
                    <th className="pb-2 pr-4 font-medium">Businesses</th>
                    <th className="pb-2 pr-4 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 dark:text-white">{u.full_name || '(no name)'}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${u.role === 'admin' ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' : u.role === 'support' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {u.mfa_enabled ? (
                          <ShieldCheck className="w-4 h-4 text-accent-500" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-slate-300" />
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{u.business_count}</td>
                      <td className="py-3 pr-4 text-xs text-slate-400">{formatRelativeTime(u.created_at)}</td>
                      <td className="py-3">
                        {u.id !== user?.id && (
                          <select
                            value={u.role}
                            onChange={(e) => {
                              setActionError(null);
                              setActionSuccess(null);
                              setRoleConfirm({ userId: u.id, email: u.email, newRole: e.target.value });
                            }}
                            className="input text-xs py-1 px-2 max-w-[120px]"
                          >
                            <option value="user">user</option>
                            <option value="support">support</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Audit Log</h3>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No audit log entries.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className={`badge shrink-0 ${log.event_type.includes('permission') || log.event_type.includes('admin') ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {log.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 flex-1">{log.event_description}</span>
                  <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={roleConfirm !== null}
        title="Change User Role"
        message={`Are you sure you want to change ${roleConfirm?.email} to ${roleConfirm?.newRole}? This will affect their access level.`}
        confirmLabel="Confirm Role Change"
        onConfirm={handleRoleChange}
        onCancel={() => setRoleConfirm(null)}
      />
    </div>
  );
}
