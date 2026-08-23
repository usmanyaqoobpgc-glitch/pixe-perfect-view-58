import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/lib/types';

interface MFAEnrollResult {
  error: string | null;
  qrUrl?: string;
  factorId?: string;
}

interface MFAChallengeResult {
  error: string | null;
  challengeId?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** true when the signed-in user has a verified MFA factor but the session is still aal1 */
  mfaRequired: boolean;
  refreshMFAStatus: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsMFA?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  enrollMFA: () => Promise<MFAEnrollResult>;
  verifyMFA: (factorId: string, code: string) => Promise<{ error: string | null; recoveryCodes?: string[] }>;
  unenrollMFA: (factorId: string) => Promise<{ error: string | null }>;
  challengeMFA: (factorId: string) => Promise<MFAChallengeResult>;
  verifyMFAChallenge: (factorId: string, challengeId: string, code: string) => Promise<{ error: string | null }>;
  getMFAFactors: () => Promise<{ data: unknown[] | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  /** Returns true when the session must still complete an MFA challenge. */
  const refreshMFAStatus = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      setMfaRequired(false);
      return false;
    }
    const required = data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel;
    setMfaRequired(required);
    return required;
  };


  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await refreshMFAStatus();
        await fetchProfile(session.user.id);
      } else {
        setMfaRequired(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession?.user) {
          await refreshMFAStatus();
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setMfaRequired(false);
        }
        setLoading(false);


        if (event === 'SIGNED_IN' && newSession?.user) {
          await supabase.from('security_events').insert({
            user_id: newSession.user.id,
            event_type: 'login_success',
          });
        }
        if (event === 'SIGNED_OUT') {
          if (newSession?.user) {
            await supabase.from('security_events').insert({
              user_id: newSession.user.id,
              event_type: 'logout',
            });
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // MFA required error from Supabase
      if (error.message.toLowerCase().includes('mfa') || error.code === 'mfa_required') {
        return { error: null, needsMFA: true };
      }
      await supabase.rpc('log_failed_login', {
        p_email: email,
        p_reason: error.message,
      });
      return { error: error.message };
    }
    // Password auth succeeded (aal1). If the user has a verified factor, the
    // session must be elevated to aal2 before the app is usable.
    const needsMFA = await refreshMFAStatus();
    return { error: null, needsMFA };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    // Only log when sign-up returned an active session; without one the insert
    // is unauthenticated and is (correctly) rejected by RLS.
    if (data.user && data.session) {
      await supabase.from('security_events').insert({
        user_id: data.user.id,
        event_type: 'login_success',
        metadata: { event: 'signup' },
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const signOutAll = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setProfile(null);
    if (session?.user) {
      await supabase.from('security_events').insert({
        user_id: session.user.id,
        event_type: 'session_revoke',
        metadata: { scope: 'all_devices' },
      });
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    if (session?.user) {
      await supabase.from('security_events').insert({
        user_id: session.user.id,
        event_type: 'password_change',
      });
    }
    return { error: null };
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  // ============================================================
  // MFA / TOTP methods (Supabase built-in)
  // ============================================================

  const getMFAFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { data: null, error: error.message };
    return { data: data.all ?? [], error: null };
  };

  const enrollMFA = async (): Promise<MFAEnrollResult> => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'AI Business Builder',
      });
      if (error) return { error: error.message };
      return {
        error: null,
        qrUrl: (data as { totp: { qr_code: string } }).totp.qr_code,
        factorId: (data as { id: string }).id,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to enroll MFA' };
    }
  };

  const verifyMFA = async (
    factorId: string,
    code: string,
  ): Promise<{ error: string | null; recoveryCodes?: string[] }> => {
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (chErr) return { error: chErr.message };

      const { data: verifyData, error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) return { error: vErr.message };

      // Update profile mfa_enabled flag
      await supabase.from('profiles').update({ mfa_enabled: true }).eq('id', session?.user?.id ?? '');
      await fetchProfile(session?.user?.id ?? '');

      // Log MFA enrollment
      await supabase.from('security_events').insert({
        user_id: session?.user?.id,
        event_type: 'mfa_enrolled',
        metadata: { factor_id: factorId },
      });

      const recoveryCodes = (verifyData as { recovery_codes?: string[] })?.recovery_codes;
      return { error: null, recoveryCodes };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to verify MFA' };
    }
  };

  const unenrollMFA = async (
    factorId: string,
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) return { error: error.message };

      // Update profile mfa_enabled flag
      await supabase.from('profiles').update({ mfa_enabled: false }).eq('id', session?.user?.id ?? '');
      await fetchProfile(session?.user?.id ?? '');

      // Log MFA removal
      await supabase.from('security_events').insert({
        user_id: session?.user?.id,
        event_type: 'mfa_removed',
        metadata: { factor_id: factorId },
      });

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove MFA' };
    }
  };

  const challengeMFA = async (factorId: string): Promise<MFAChallengeResult> => {
    try {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) return { error: error.message };
      return { error: null, challengeId: data.id };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to create MFA challenge' };
    }
  };

  const verifyMFAChallenge = async (
    factorId: string,
    challengeId: string,
    code: string,
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (error) {
        // Log failed MFA verification
        await supabase.rpc('log_failed_login', {
          p_email: session?.user?.email ?? 'unknown',
          p_reason: `MFA verification failed: ${error.message}`,
        });
        return { error: error.message };
      }
      // Session is now aal2 — clear the pending-challenge gate.
      await refreshMFAStatus();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to verify MFA' };
    }
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    mfaRequired,
    refreshMFAStatus,
    signIn,
    signUp,
    signOut,
    signOutAll,
    resetPassword,
    updatePassword,
    refreshProfile,
    enrollMFA,
    verifyMFA,
    unenrollMFA,
    challengeMFA,
    verifyMFAChallenge,
    getMFAFactors,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
