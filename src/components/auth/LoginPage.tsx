'use client';

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HardDriveDownload,
  RefreshCw,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  Building2,
  KeyRound,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const {
    authLoading,
    signIn,
    signUp,
    theme,
    setTheme,
    showMigrationPrompt,
    setShowMigrationPrompt,
    localItemsCount,
    activeWorkspaceId,
    migrateLocalDataToCloud,
    retryFailedMigration,
    migrationProgress,
  } = useSessionStore();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [emailConfirmationNeeded, setEmailConfirmationNeeded] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const isLight = theme === 'light';

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    let res = await signIn(cleanEmail, cleanPassword);

    // If trimmed password fails and raw password had whitespace, fallback to raw password
    if (!res.success && password !== cleanPassword) {
      res = await signIn(cleanEmail, password);
    }
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid email or password.');
    } else {
      setSuccessMsg('Signed in successfully! Loading your workspace...');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailConfirmationNeeded(null);

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password || !cleanName) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await signUp(cleanEmail, password, cleanName);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create account.');
    } else if (res.requiresEmailConfirmation) {
      setEmailConfirmationNeeded(res.email || cleanEmail);
    } else {
      setSuccessMsg('Account created successfully! Welcome to Record Book.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address to receive password reset instructions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      });

      setIsSubmitting(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`Password reset instructions sent to ${cleanEmail}. Please check your inbox.`);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to send password reset email.');
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address to resend confirmation link.');
      return;
    }
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      setIsResending(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`Confirmation email resent to ${cleanEmail}! Please check your inbox.`);
      }
    } catch (err: any) {
      setIsResending(false);
      setErrorMsg(err?.message || 'Failed to resend confirmation email.');
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    setErrorMsg(null);
    let result;
    if (migrationProgress?.failedRecords && migrationProgress.failedRecords.length > 0) {
      result = await retryFailedMigration(activeWorkspaceId, migrationProgress.failedRecords);
    } else {
      result = await migrateLocalDataToCloud(activeWorkspaceId);
    }
    setIsMigrating(false);

    if (result.success) {
      setSuccessMsg(`Successfully migrated ${result.migrated} records to your cloud workspace.`);
      setTimeout(() => {
        setShowMigrationPrompt(false);
      }, 1200);
    } else {
      setErrorMsg(result.error || 'Migration encountered an issue. Local records were preserved safely.');
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-300 relative ${
        isLight
          ? 'bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 text-slate-900'
          : 'bg-[#070a12] text-slate-100'
      }`}
    >
      {/* Dynamic Background Mesh Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-20">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      {/* Header Bar */}
      <header
        className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between"
        style={{
          paddingTop: 'max(0.65rem, env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center font-black text-xs text-white shadow-lg shadow-indigo-600/30">
            RB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tight text-slate-900 dark:text-white">
                Record Book AI
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                PRO 2.0
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Multi-Entity Financial Operating System
            </p>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer shadow-xs"
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </header>

      {/* Main Authentication Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md">
          {/* Post-Login Migration Prompt Card (If local records exist) */}
          {showMigrationPrompt ? (
            <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 w-fit">
                <HardDriveDownload className="w-7 h-7 stroke-[2]" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Migrate Offline Records to Cloud
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  We found <strong className="text-indigo-600 dark:text-indigo-400">{localItemsCount} local records</strong>{' '}
                  (accounts, dues, ledger entries, notes, sheets) on this browser. Would you like to securely upload them to your verified cloud account?
                </p>
              </div>

              {/* Progress Indicator */}
              {migrationProgress && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="capitalize text-slate-700 dark:text-slate-300">
                      Step: {migrationProgress.currentStep || migrationProgress.status}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {migrationProgress.progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${migrationProgress.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Migrating & Reconciling Balances...</span>
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="w-4 h-4" />
                      <span>Migrate All Records to Account</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowMigrationPrompt(false)}
                  disabled={isMigrating}
                  className="w-full py-3 px-4 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  Skip & Start Fresh with Cloud Workspace
                </button>
              </div>
            </div>
          ) : emailConfirmationNeeded ? (
            /* Email Confirmation Screen */
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="mx-auto p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 w-fit">
                <Mail className="w-8 h-8 stroke-[2]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Verify Your Email
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                  We sent a confirmation link to <strong className="text-indigo-600 dark:text-indigo-400">{emailConfirmationNeeded}</strong>.
                  Please check your inbox and click the verification link to activate your secure account.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                  className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Resend Confirmation Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmailConfirmationNeeded(null);
                    setMode('signin');
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>

                <p className="text-[10px] text-slate-400 pt-1">
                  💡 <em>To bypass email verification in development, run <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-black/30 font-mono text-[9px]">UPDATE auth.users SET email_confirmed_at = now();</code> in Supabase SQL Editor.</em>
                </p>
              </div>
            </div>
          ) : (
            /* Main Authentication Card */
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Segmented Mode Switcher (Sign In vs Sign Up) */}
              {mode !== 'forgot_password' && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      mode === 'signin'
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Title Header */}
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {mode === 'signin' && 'Welcome Back'}
                  {mode === 'signup' && 'Create Your Cloud Account'}
                  {mode === 'forgot_password' && 'Reset Password'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === 'signin' && 'Sign in to access your business, personal & family books.'}
                  {mode === 'signup' && 'Get instant access with atomic sync and multi-sphere isolation.'}
                  {mode === 'forgot_password' && 'Enter your email to receive recovery instructions.'}
                </p>
              </div>

              {/* Error & Success Messages */}
              {errorMsg && errorMsg.toLowerCase().includes('email not confirmed') ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Email Confirmation Required</span>
                  </div>
                  <p className="leading-relaxed">
                    Supabase sent a confirmation email to <strong>{email.trim() || 'your email'}</strong>. You must click the confirmation link in your inbox before signing in.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={isResending}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Resend Confirmation Email</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-amber-500/10">
                    💡 <em>Instant dev bypass: Run <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-black/30 font-mono text-[9px]">UPDATE auth.users SET email_confirmed_at = now();</code> in your Supabase SQL Editor.</em>
                  </p>
                </div>
              ) : errorMsg ? (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              ) : null}
              {successMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* FORMS */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot_password');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || authLoading}
                    className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {isSubmitting || authLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        autoCapitalize="words"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="e.g. Rahul Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || authLoading}
                    className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {isSubmitting || authLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {mode === 'forgot_password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          color: isLight ? '#0f172a' : '#f8fafc',
                          WebkitTextFillColor: isLight ? '#0f172a' : '#f8fafc',
                          caretColor: '#4f46e5',
                        }}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Reset Link</span>}
                    </button>
                  </div>
                </form>
              )}

              {/* Trust Badges */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-semibold">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Strict PostgreSQL RLS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Multi-Tenant Workspaces</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-[11px] text-slate-400">
        Record Book AI • Enterprise Multi-Entity Financial Operating System • Powered by Supabase
      </footer>
    </div>
  );
}
