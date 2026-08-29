import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import {
  ShieldCheck, ShieldAlert, Key, Smartphone, Monitor,
  LogOut, Clock, AlertCircle, CheckCircle2, Lock,
  Copy, Check,
} from 'lucide-react';
import type { SecurityEvent } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';

interface MFAFactor {
  id: string;
  status: 'verified' | 'unverified';
  friendly_name: string | null;
  factor_type: string;
}

type MFAStep = 'idle' | 'enrolling' | 'verifying' | 'recovery';

export function SecurityPage() {
  const { user, signOutAll, updatePassword, enrollMFA, verifyMFA, unenrollMFA, getMFAFactors, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [mfaStep, setMfaStep] = useState<MFAStep>('idle');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [disableMfaConfirm, setDisableMfaConfirm] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setEvents(data as SecurityEvent[] ?? []);
      await loadMFAFactors();
      setLoading(false);
    }
    load();
  }, [user]);

  const loadMFAFactors = async () => {
    const { data, error } = await getMFAFactors();
    if (error) {
      console.error('Error loading MFA factors:', error);
      return;
    }
    setMfaFactors((data ?? []) as MFAFactor[]);
  };

  const handleRevokeAll = async () => {
    setRevokeConfirm(false);
    await signOutAll();
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Password must include uppercase, lowercase, and a number.');
      return;
    }
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError(error);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setTimeout(() => { setPasswordModal(false); setPasswordSuccess(false); }, 2000);
    }
  };

  // ============================================================
  // MFA enrollment flow
  // ============================================================
  const startEnrollMFA = async () => {
    setMfaError(null);
    setMfaStep('enrolling');
    const result = await enrollMFA();
    if (result.error) {
      setMfaError(result.error);
      setMfaStep('idle');
      return;
    }
    setQrUrl(result.qrUrl ?? null);
    setPendingFactorId(result.factorId ?? null);
    setMfaStep('verifying');
  };

  const handleVerifyMFA = async () => {
    if (!pendingFactorId || !verifyCode.trim()) {
      setMfaError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setMfaError(null);
    const result = await verifyMFA(pendingFactorId, verifyCode.trim());
    if (result.error) {
      setMfaError(result.error);
      return;
    }
    setRecoveryCodes(result.recoveryCodes ?? null);
    setVerifyCode('');
    setMfaStep('recovery');
    await loadMFAFactors();
    await refreshProfile();
  };

  const handleDisableMFA = async () => {
    setDisableMfaConfirm(false);
    setDisabling(true);
    setMfaError(null);
    const verifiedFactor = mfaFactors.find((f) => f.status === 'verified');
    if (!verifiedFactor) {
      setMfaError('No verified MFA factor found.');
      setDisabling(false);
      return;
    }
    const result = await unenrollMFA(verifiedFactor.id);
    if (result.error) {
      setMfaError(result.error);
    } else {
      await loadMFAFactors();
      await refreshProfile();
    }
    setDisabling(false);
  };

  const cancelEnrollment = () => {
    setMfaStep('idle');
    setQrUrl(null);
    setPendingFactorId(null);
    setVerifyCode('');
    setMfaError(null);
  };

  const copyRecoveryCodes = () => {
    if (recoveryCodes) {
      navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const finishRecovery = () => {
    setMfaStep('idle');
    setRecoveryCodes(null);
  };

  if (loading) return <LoadingState />;

  const hasVerifiedMFA = mfaFactors.some((f) => f.status === 'verified');
  const failedLogins = events.filter((e) => e.event_type === 'login_failed');
  const recentLogins = events.filter((e) => e.event_type === 'login_success');

  return (
    <div>
      <PageHeader title="Security Center" description="Manage your account security" />

      {/* Security status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Password</p>
              <p className="text-xs text-accent-600">Protected</p>
            </div>
          </div>
          <button onClick={() => setPasswordModal(true)} className="text-xs text-primary-600 hover:underline mt-2">
            Change password
          </button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasVerifiedMFA ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600' : 'bg-warning-50 dark:bg-warning-500/10 text-warning-600'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">MFA / 2FA</p>
              <p className="text-xs text-slate-400">{hasVerifiedMFA ? 'Enabled' : 'Not enabled'}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Protect your account with an authenticator app.</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">API Keys</p>
              <p className="text-xs text-slate-400">No keys configured</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Keys are stored securely and never exposed to the client.</p>
        </div>
      </div>

      {/* MFA Management Section */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Two-Factor Authentication (MFA)</h3>
        </div>

        {mfaError && (
          <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm">
            {mfaError}
          </div>
        )}

        {/* MFA idle state */}
        {mfaStep === 'idle' && !hasVerifiedMFA && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add an extra layer of security to your account. When enabled, you'll need a code from your
              authenticator app (like Google Authenticator, Authy, or 1Password) in addition to your password.
            </p>
            <button onClick={startEnrollMFA} className="btn-primary">
              <Smartphone className="w-4 h-4" /> Enable MFA
            </button>
          </div>
        )}

        {/* MFA idle state - already enabled */}
        {mfaStep === 'idle' && hasVerifiedMFA && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-50 dark:bg-accent-500/10">
              <CheckCircle2 className="w-5 h-5 text-accent-600" />
              <p className="text-sm text-accent-700 dark:text-accent-400">
                Two-factor authentication is active. You'll need your authenticator app to sign in.
              </p>
            </div>
            <button
              onClick={() => setDisableMfaConfirm(true)}
              disabled={disabling}
              className="btn-danger text-sm"
            >
              <ShieldAlert className="w-4 h-4" /> {disabling ? 'Removing...' : 'Disable MFA'}
            </button>
          </div>
        )}

        {/* MFA enrollment step - QR code */}
        {mfaStep === 'verifying' && qrUrl && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <p className="mb-2 font-medium text-slate-700 dark:text-slate-300">Step 1: Scan this QR code</p>
              <p>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code below or enter the secret manually.</p>
            </div>
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="p-3 bg-white rounded-lg">
                <img src={qrUrl} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-slate-700 dark:text-slate-300 text-sm">Step 2: Enter the 6-digit code</p>
              <p className="text-xs text-slate-400 mb-3">Enter the code shown in your authenticator app.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="input text-center text-lg tracking-widest max-w-[200px]"
                placeholder="000000"
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyMFA(); }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={cancelEnrollment} className="btn-secondary">Cancel</button>
              <button onClick={handleVerifyMFA} disabled={verifyCode.length !== 6} className="btn-primary">
                <Check className="w-4 h-4" /> Verify & Enable
              </button>
            </div>
          </div>
        )}

        {/* MFA recovery codes step */}
        {mfaStep === 'recovery' && recoveryCodes && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 text-sm">
              <p className="font-medium mb-1">Save your recovery codes!</p>
              <p>These codes allow you to access your account if you lose your authenticator device. Store them safely — they won't be shown again.</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 font-mono text-sm grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="text-slate-700 dark:text-slate-300">{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={copyRecoveryCodes} className="btn-secondary">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Codes'}
              </button>
              <button onClick={finishRecovery} className="btn-primary">
                I've Saved Them
              </button>
            </div>
          </div>
        )}

        {/* Enrolling state (loading) */}
        {mfaStep === 'enrolling' && (
          <div className="flex items-center gap-3 p-4">
            <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500">Setting up MFA...</p>
          </div>
        )}
      </div>

      {/* Active sessions */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Active Sessions</h3>
          </div>
          <button onClick={() => setRevokeConfirm(true)} className="btn-danger text-sm">
            <LogOut className="w-4 h-4" /> Revoke All Sessions
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <Monitor className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">Current Session</p>
              <p className="text-xs text-slate-400">This device · Active now</p>
            </div>
            <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">Active</span>
          </div>
        </div>
      </div>

      {/* Recent logins */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Logins</h3>
        </div>
        {recentLogins.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No recent login events.</p>
        ) : (
          <div className="space-y-2">
            {recentLogins.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-accent-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">Login</span>
                <span className="text-slate-400 ml-auto">{formatRelativeTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suspicious activity */}
      {failedLogins.length > 0 && (
        <div className="card p-5 mb-6 border-warning-200 dark:border-warning-500/30">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-warning-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Suspicious Login Attempts</h3>
          </div>
          <div className="space-y-2">
            {failedLogins.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <AlertCircle className="w-4 h-4 text-warning-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">Failed login attempt</span>
                <span className="text-slate-400 ml-auto">{formatRelativeTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security event log */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Security Event Log</h3>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No security events recorded.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className={`badge ${e.event_type.includes('failed') || e.event_type.includes('suspicious') ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-400' : e.event_type.includes('mfa') ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {e.event_type.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-400 ml-auto">{formatRelativeTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={revokeConfirm}
        title="Revoke All Sessions"
        message="This will sign you out from all devices, including this one. You'll need to sign in again."
        confirmLabel="Revoke All"
        onConfirm={handleRevokeAll}
        onCancel={() => setRevokeConfirm(false)}
      />

      <ConfirmDialog
        open={disableMfaConfirm}
        title="Disable MFA"
        message="Are you sure you want to disable two-factor authentication? Your account will be less secure."
        confirmLabel="Disable MFA"
        onConfirm={handleDisableMFA}
        onCancel={() => setDisableMfaConfirm(false)}
      />

      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setPasswordModal(false)}>
          <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Change Password</h3>
            {passwordSuccess ? (
              <p className="text-sm text-accent-600 mb-4">Password changed successfully.</p>
            ) : (
              <>
                <input
                  type="password"
                  className="input mb-3"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {passwordError && <p className="text-xs text-error-600 mb-3">{passwordError}</p>}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setPasswordModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handlePasswordChange} className="btn-primary">Update</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
