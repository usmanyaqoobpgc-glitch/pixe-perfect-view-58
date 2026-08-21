import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import {
  Settings as SettingsIcon, User, Palette, Shield, Trash2, Download, Check,
} from 'lucide-react';

type Tab = 'profile' | 'appearance' | 'privacy' | 'data';

export function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const saveProfile = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = async () => {
    setExportLoading(true);
    const tables: string[] = ['businesses', 'business_plans', 'milestones', 'tasks', 'leads', 'customers', 'revenue_records', 'marketing_content', 'website_drafts', 'notifications', 'audit_logs', 'security_events'];
    const exportData: Record<string, unknown> = {};
    for (const table of tables) {
      const { data } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown }> } }).from(table).select('*');
      exportData[table] = data;
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  const deleteAccount = async () => {
    setDeleteConfirm(false);
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setDeleteError('You must be signed in to delete your account.');
        setDeleteLoading(false);
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        setDeleteError('Failed to delete account. Please try again or contact support.');
        setDeleteLoading(false);
        return;
      }
      await signOut();
    } catch {
      setDeleteError('Failed to delete account. Please try again or contact support.');
      setDeleteLoading(false);
    }
  };

  if (!user) return <LoadingState />;

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'privacy', label: 'Privacy', icon: Shield },
    { key: 'data', label: 'Data', icon: Download },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-48 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.key ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {tab === 'profile' && (
            <div className="card p-6 space-y-4 animate-fade-in">
              <h3 className="font-semibold text-slate-900 dark:text-white">Profile Information</h3>
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={profile?.email ?? ''} disabled />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed here.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveProfile} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {saved && <span className="text-sm text-accent-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="card p-6 space-y-4 animate-fade-in">
              <h3 className="font-semibold text-slate-900 dark:text-white">Appearance</h3>
              <p className="text-sm text-slate-500">Use the sun/moon toggle in the top bar to switch between light and dark mode. Your preference is saved automatically.</p>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="card p-6 space-y-4 animate-fade-in">
              <h3 className="font-semibold text-slate-900 dark:text-white">Privacy</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <Shield className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Data Isolation</p>
                    <p className="text-xs text-slate-400 mt-1">Your business data is private and isolated. No other user can access your records. Row-level security is enforced at the database level.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <SettingsIcon className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">AI Data Usage</p>
                    <p className="text-xs text-slate-400 mt-1">Your private business data is not used to train AI models. AI-generated content is clearly labeled as estimates where applicable.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div className="card p-6 space-y-4 animate-fade-in">
              <h3 className="font-semibold text-slate-900 dark:text-white">Data Management</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Export Your Data</p>
                    <p className="text-xs text-slate-400 mt-1">Download all your business data as JSON.</p>
                  </div>
                  <button onClick={exportData} disabled={exportLoading} className="btn-secondary">
                    <Download className="w-4 h-4" /> {exportLoading ? 'Exporting...' : 'Export'}
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20">
                  <div>
                    <p className="text-sm font-medium text-error-700 dark:text-error-400">Delete Account</p>
                    <p className="text-xs text-slate-400 mt-1">Permanently delete your account and all associated data. This cannot be undone.</p>
                  </div>
                  <button onClick={() => { setDeleteConfirm(true); setDeleteError(null); }} disabled={deleteLoading} className="btn-danger">
                    <Trash2 className="w-4 h-4" /> {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                {deleteError && (
                  <p className="text-xs text-error-600 px-1">{deleteError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Account"
        message="This will permanently delete your account and ALL your business data. This action is irreversible."
        confirmLabel="Delete Forever"
        onConfirm={deleteAccount}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
