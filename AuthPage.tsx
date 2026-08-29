import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Eye, EyeOff, Smartphone, ArrowLeft } from 'lucide-react';

export function AuthPage({ forceMFA = false }: { forceMFA?: boolean }) {
  const { signIn, signUp, resetPassword, challengeMFA, verifyMFAChallenge, signOut } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'mfa'>(forceMFA ? 'mfa' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // MFA challenge state
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const startMFAChallenge = async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedFactor = (factors?.all ?? []).find(
      (f: { status: string; factor_type: string }) => f.status === 'verified' && f.factor_type === 'totp'
    );
    if (!verifiedFactor) {
      setError('MFA is required but no verified factor was found. Please contact support.');
      return false;
    }
    setMfaFactorId(verifiedFactor.id);
    const result = await challengeMFA(verifiedFactor.id);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setMfaChallengeId(result.challengeId ?? null);
    setMode('mfa');
    return true;
  };

  // Session exists at aal1 but the account has MFA: challenge immediately.
  useEffect(() => {
    if (!forceMFA) return;
    setMode('mfa');
    if (!mfaChallengeId) {
      void startMFAChallenge();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceMFA]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error, needsMFA } = await signIn(email, password);
        if (error) {
          setError(error);
        } else if (needsMFA) {
          await startMFAChallenge();
        }
      } else if (mode === 'signup') {
        if (!passwordValid) {
          setError('Password does not meet the requirements below.');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) setError(error);
        else setSuccess('Account created! Check your email if confirmation is required, then sign in.');
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) setError(error);
        else setSuccess('Password reset link sent to your email.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId || mfaCode.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await verifyMFAChallenge(mfaFactorId, mfaChallengeId, mfaCode);
      if (error) {
        setError(error);
        setMfaCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const backToSignIn = async () => {
    if (forceMFA) await signOut();
    setMode('signin');
    setMfaCode('');
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Business Builder</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Turn your idea into an executable business plan
          </p>
        </div>

        <div className="card p-6">
          {/* MFA Challenge View */}
          {mode === 'mfa' ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verify Your Identity</h2>
                  <p className="text-sm text-slate-400">Enter the code from your authenticator app</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 text-sm animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleMFAVerify} className="space-y-4">
                <div>
                  <label className="label">Authentication Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="input text-center text-lg tracking-widest"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full">
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </form>

              <button
                onClick={() => void backToSignIn()}
                className="mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </>
          ) : (
            <>
              {/* Regular Sign In / Sign Up / Reset View */}
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
                <button
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'signin' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'signup' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Sign Up
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 text-sm animate-fade-in">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 text-sm animate-fade-in">
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input"
                      placeholder="Jane Doe"
                    />
                  </div>
                )}
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {mode !== 'reset' && (
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input pr-10"
                        placeholder={mode === 'signup' ? 'Create a strong password' : 'Your password'}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mode === 'signup' && (
                      <div className="mt-2 space-y-1">
                        <PasswordCheck label="At least 8 characters" passed={passwordChecks.length} />
                        <PasswordCheck label="Uppercase letter" passed={passwordChecks.upper} />
                        <PasswordCheck label="Lowercase letter" passed={passwordChecks.lower} />
                        <PasswordCheck label="Number" passed={passwordChecks.number} />
                      </div>
                    )}
                  </div>
                )}

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Forgot your password?
                  </button>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                </button>
              </form>

              {mode === 'reset' && (
                <button
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className="mt-4 text-sm text-slate-500 hover:text-primary-600 w-full text-center"
                >
                  Back to sign in
                </button>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Protected by secure authentication. Your data is encrypted and private.
        </p>
      </div>
    </div>
  );
}

function PasswordCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${passed ? 'bg-accent-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
        {passed && <span className="text-white text-[8px]">✓</span>}
      </div>
      <span className={passed ? 'text-accent-600 dark:text-accent-400' : 'text-slate-400'}>
        {label}
      </span>
    </div>
  );
}
