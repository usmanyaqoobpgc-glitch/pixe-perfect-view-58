import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { LoadingState, PageHeader, ConfirmDialog, StatCard } from '@/components/ui';
import {
  ShieldCheck, Users, ScrollText, Search, ShieldAlert, CheckCircle2, LayoutDashboard,
  Briefcase, UserPlus, ListTodo, Bot, DollarSign, X, Download,
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
  metadata: Record<string, unknown>;
  created_at: string;
}

type Overview = Record<'users' | 'businesses' | 'leads' | 'customers' | 'tasks' | 'agent_tasks' | 'agent_runs' | 'revenue' | 'expenses', number>;
type Row = Record<string, unknown>;
type UserData = Record<string, Row[]> & { profile?: Row };

const SECTIONS: { key: string; label: string }[] = [
  { key: 'businesses', label: 'Businesses' },
  { key: 'leads', label: 'Leads' },
  { key: 'customers', label: 'Customers' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'agent_tasks', label: 'Agent tasks' },
  { key: 'agent_runs', label: 'Agent runs' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'marketing_content', label: 'Marketing content' },
  { key: 'website_drafts', label: 'Website drafts' },
];

type Tab = 'overview' | 'users' | 'audit';

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function exportCsv(name: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(cell(r[c]))).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function UserDetail({ target, onClose }: { target: StaffUser; onClose: () => void }) {
  const [data, setData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('admin_get_user_data' as never, { p_user_id: target.id } as never).then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else setData(data as unknown as UserData);
    });
    return () => { alive = false; };
  }, [target.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="w-full max-w-3xl h-full overflow-y-auto bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{target.full_name || target.email}</h3>
            <p className="text-sm text-slate-500">{target.email} · {target.role}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <div className="p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm">{error}</div>}
        {!data && !error && <LoadingState label="Loading user data..." />}
        {data && SECTIONS.map(({ key, label }) => {
          const rows = (data[key] as Row[] | undefined) ?? [];
          const cols = rows.length ? Object.keys(rows[0]).filter((c) => c !== 'id' && c !== 'business_id') : [];
          return (
            <section key={key} className="card p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{label} <span className="text-slate-400 font-normal">({rows.length})</span></h4>
                <button
                  disabled={!rows.length}
                  onClick={() => exportCsv(`${target.email}-${key}`, rows)}
                  className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing saved yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        {cols.map((c) => <th key={c} className="pb-1 pr-3 font-medium whitespace-nowrap">{c.replace(/_/g, ' ')}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={String(r.id ?? i)} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          {cols.map((c) => <td key={c} className="py-1 pr-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{cell(r[c])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; email: string; newRole: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate({ to: '/' });
  }, [authLoading, isAdmin, navigate]);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc('staff_list_users');
    if (error) setActionError(error.message);
    else setUsers(data as StaffUser[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    if (tab === 'users') await loadUsers();
    else if (tab === 'audit') {
      const { data, error } = await supabase.rpc('admin_get_audit_logs', { p_limit: 100 });
      if (error) setActionError(error.message);
      else setAuditLogs(data as AuditLogEntry[]);
    } else {
      const { data, error } = await supabase.rpc('admin_get_overview' as never);
      if (error) setActionError(error.message);
      else setOverview(data as unknown as Overview);
    }
    setLoading(false);
  }, [tab, loadUsers]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const handleRoleChange = async () => {
    if (!roleConfirm || saving) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: roleConfirm.userId,
      p_role: roleConfirm.newRole,
    });
    if (error) setActionError(error.message);
    else {
      setActionSuccess(`Updated ${roleConfirm.email} to ${roleConfirm.newRole}`);
      await loadUsers();
    }
    setRoleConfirm(null);
    setSaving(false);
  };

  const q = search.toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      (roleFilter === 'all' || u.role === roleFilter) &&
      (u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)),
  );

  if (authLoading || !isAdmin) return <LoadingState />;

  const tabBtn = (t: Tab, label: string, Icon: typeof Users) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div>
      <PageHeader title="Admin Panel" description="All users' saved data (read-only), roles and audit logs" />

      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={load} className="text-xs underline">Retry</button>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-600 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
        </div>
      )}

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6 max-w-md">
        {tabBtn('overview', 'Overview', LayoutDashboard)}
        {tabBtn('users', 'Users', Users)}
        {tabBtn('audit', 'Audit Log', ScrollText)}
      </div>

      {loading ? <LoadingState /> : (
        <>
          {tab === 'overview' && overview && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Users" value={overview.users} icon={Users} />
              <StatCard label="Businesses" value={overview.businesses} icon={Briefcase} />
              <StatCard label="Leads" value={overview.leads} icon={UserPlus} color="accent" />
              <StatCard label="Customers" value={overview.customers} icon={Users} color="accent" />
              <StatCard label="Tasks" value={overview.tasks} icon={ListTodo} />
              <StatCard label="Agent tasks" value={overview.agent_tasks} icon={Bot} />
              <StatCard label="Agent runs" value={overview.agent_runs} icon={Bot} color="warning" />
              <StatCard label="Revenue recorded" value={Number(overview.revenue).toLocaleString()} icon={DollarSign} color="accent" />
            </div>
          )}

          {tab === 'users' && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">All Users</h3>
                <div className="flex gap-2">
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input text-sm py-1.5 max-w-[130px]">
                    <option value="all">All roles</option>
                    <option value="user">user</option>
                    <option value="support">support</option>
                    <option value="admin">admin</option>
                  </select>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm max-w-[240px]" placeholder="Search users..." />
                  </div>
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
                            <button onClick={() => setSelected(u)} className="text-left hover:underline">
                              <p className="font-medium text-slate-900 dark:text-white">{u.full_name || '(no name)'}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </button>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`badge ${u.role === 'admin' ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' : u.role === 'support' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{u.role}</span>
                          </td>
                          <td className="py-3 pr-4">
                            {u.mfa_enabled ? <ShieldCheck className="w-4 h-4 text-accent-500" /> : <ShieldAlert className="w-4 h-4 text-slate-300" />}
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{u.business_count}</td>
                          <td className="py-3 pr-4 text-xs text-slate-400">{formatRelativeTime(u.created_at)}</td>
                          <td className="py-3 flex gap-2 items-center">
                            <button onClick={() => setSelected(u)} className="btn-secondary text-xs py-1 px-2">View data</button>
                            {u.id !== user?.id && (
                              <select
                                value={u.role}
                                disabled={saving}
                                onChange={(e) => {
                                  setActionError(null);
                                  setActionSuccess(null);
                                  setRoleConfirm({ userId: u.id, email: u.email, newRole: e.target.value });
                                }}
                                className="input text-xs py-1 px-2 max-w-[110px]"
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
        </>
      )}

      {selected && <UserDetail target={selected} onClose={() => setSelected(null)} />}

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
