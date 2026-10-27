'use client';

import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDriveDownload,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

export function AuthModal() {
  const {
    isAuthModalOpen,
    setAuthModalOpen,
    authLoading,
    signIn,
    signUp,
    theme,
    showMigrationPrompt,
    setShowMigrationPrompt,
    localItemsCount,
    activeWorkspaceId,
    migrateLocalDataToCloud,
  } = useSessionStore();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  if (!isAuthModalOpen) return null;

  const isLight = theme === 'light';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    const res = await signIn(email.trim(), password);
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid email or password.');
    } else {
      setSuccessMsg('Signed in successfully!');
      setTimeout(() => {
        setAuthModalOpen(false);
      }, 500);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password || !fullName) {
      setErrorMsg('Please fill out all fields.');
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

    const res = await signUp(email.trim(), password, fullName.trim());
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create account.');
    } else {
      setSuccessMsg('Account created successfully! Welcome to Record Book.');
      setTimeout(() => {
        setAuthModalOpen(false);
      }, 800);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    const result = await migrateLocalDataToCloud(activeWorkspaceId);
    setMigrating(false);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg(`Migrated ${result.count} records to your cloud workspace.`);
      setTimeout(() => {
        setShowMigrationPrompt(false);
        setAuthModalOpen(false);
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden glass-panel ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-inherit bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent">
          <button
            onClick={() => setAuthModalOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Record Book Cloud</h2>
              <p className="text-xs text-slate-400">Multi-device sync & role-based workspaces</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {!showMigrationPrompt && (
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tab === 'signin'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tab === 'signup'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Migration Banner if user logged in with local records */}
        {showMigrationPrompt ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
              <div className="flex items-start gap-3">
                <HardDriveDownload className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
                <div>
                  <h4 className="text-sm font-bold">Offline Records Found</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    We detected <span className="font-semibold text-indigo-500">{localItemsCount}</span> offline items
                    saved on this device. Would you like to migrate them to your authenticated cloud workspace?
                  </p>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowMigrationPrompt(false);
                  setAuthModalOpen(false);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  isLight
                    ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'border-white/10 text-slate-300 hover:bg-white/5'
                }`}
              >
                Keep Local Only
              </button>
              <button
                type="button"
                disabled={migrating}
                onClick={handleMigrate}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
                Migrate to Cloud
              </button>
            </div>
          </div>
        ) : (
          /* Sign In & Sign Up Form */
          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border outline-hidden transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500'
                        : 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-indigo-400'
                    }`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border outline-hidden transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500'
                      : 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-indigo-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border outline-hidden transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500'
                      : 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-indigo-400'
                  }`}
                />
              </div>
            </div>

            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border outline-hidden transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500'
                        : 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-indigo-400'
                    }`}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-2 py-3 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 hover:from-violet-500 hover:to-teal-400 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover-lift touch-press"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{tab === 'signin' ? 'Sign In & Access Cloud' : 'Create My Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition-colors"
              >
                Continue in Local-Only Mode
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
