'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { TabType, LedgerEntry } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AppLockScreen } from '@/components/security/AppLockScreen';
import { syncEngine } from '@/lib/syncEngine';
import { cloudSnapshotEngine } from '@/lib/cloudSnapshotEngine';
import { X, Camera, Mic, Shield } from 'lucide-react';

// Dynamic Code Splitting for ultra-fast startup
const DashboardScreen = dynamic(
  () => import('@/components/screens/DashboardScreen').then((m) => m.DashboardScreen)
);
const CashScreen = dynamic(() => import('@/components/screens/CashScreen').then((m) => m.CashScreen));
const ExpensesScreen = dynamic(
  () => import('@/components/screens/ExpensesScreen').then((m) => m.ExpensesScreen)
);
const DuesScreen = dynamic(() => import('@/components/screens/DuesScreen').then((m) => m.DuesScreen));
const CardsScreen = dynamic(() => import('@/components/screens/CardsScreen').then((m) => m.CardsScreen));
const SheetsScreen = dynamic(() => import('@/components/screens/SheetsScreen').then((m) => m.SheetsScreen));
const NotesScreen = dynamic(() => import('@/components/screens/NotesScreen').then((m) => m.NotesScreen));
const VaultScreen = dynamic(() => import('@/components/screens/VaultScreen').then((m) => m.VaultScreen));
const ReportsScreen = dynamic(() => import('@/components/screens/ReportsScreen').then((m) => m.ReportsScreen));

// Modals dynamically imported and mounted only on user trigger
const AskAIModal = dynamic(() => import('@/components/ai/AskAIModal').then((m) => m.AskAIModal));
const ReceiptScannerModal = dynamic(
  () => import('@/components/modals/ReceiptScannerModal').then((m) => m.ReceiptScannerModal)
);
const VoiceExpenseModal = dynamic(
  () => import('@/components/modals/VoiceExpenseModal').then((m) => m.VoiceExpenseModal)
);
const QuickTransactionModal = dynamic(
  () => import('@/components/modals/QuickTransactionModal').then((m) => m.QuickTransactionModal)
);
const BackupRestoreModal = dynamic(
  () => import('@/components/modals/BackupRestoreModal').then((m) => m.BackupRestoreModal)
);
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));
const LoginPage = dynamic(() => import('@/components/auth/LoginPage').then((m) => m.LoginPage));
const WorkspaceMembersModal = dynamic(
  () => import('@/components/modals/WorkspaceMembersModal').then((m) => m.WorkspaceMembersModal)
);

export function AppShell() {
  const { user, authLoading, theme, activeWorkspaceId, initAuth } = useSessionStore();
  const { addEntryOptimistic } = useLedgerStore();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Quick transaction modals
  const [showCashModal, setShowCashModal] = useState<'in' | 'out' | null>(null);

  // Initialize authentic Supabase session and workspace role mapping
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Cloud Sync & Realtime Engine (Active only when user is authenticated)
  useEffect(() => {
    if (user && activeWorkspaceId) {
      syncEngine.pullAll(activeWorkspaceId);
      syncEngine.subscribeRealtime(activeWorkspaceId);

      // Run daily automated cloud snapshot check in background after 3s
      const snapTimer = setTimeout(() => {
        cloudSnapshotEngine.checkAndRunAutoDailySnapshot();
      }, 3000);

      return () => {
        clearTimeout(snapTimer);
        syncEngine.destroy();
      };
    }

    return () => {
      syncEngine.destroy();
    };
  }, [user, activeWorkspaceId]);

  // Pull latest updates when user returns to app from phone background or screen unlock (throttled to max 1 pull per 45s)
  useEffect(() => {
    let lastPull = 0;
    const handleForeground = () => {
      const now = Date.now();
      if (now - lastPull < 45000) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && user && activeWorkspaceId) {
        lastPull = now;
        syncEngine.pullAll(activeWorkspaceId);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleForeground);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleForeground);
      }
    };
  }, [user, activeWorkspaceId]);

  // Hardware Back Button & Modal Dismissal Listener (for Android Back Button & Browser Back)
  useEffect(() => {
    const handlePopState = () => {
      // If any modal is open, dismiss it
      if (isAskAIOpen || isScannerOpen || isVoiceOpen || isBackupModalOpen || showCashModal !== null || isMobileMoreOpen) {
        setIsAskAIOpen(false);
        setIsScannerOpen(false);
        setIsVoiceOpen(false);
        setIsBackupModalOpen(false);
        setShowCashModal(null);
        setIsMobileMoreOpen(false);
        return;
      }
      // If not on dashboard, return to dashboard
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [isAskAIOpen, isScannerOpen, isVoiceOpen, isBackupModalOpen, showCashModal, isMobileMoreOpen, activeTab]);

  // Push history entry whenever a modal opens so back button dismisses modal first
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const anyModalOpen = Boolean(isAskAIOpen || isScannerOpen || isVoiceOpen || isBackupModalOpen || showCashModal !== null || isMobileMoreOpen);
      if (anyModalOpen) {
        window.history.pushState({ modalOpen: true }, '');
      }
    }
  }, [isAskAIOpen, isScannerOpen, isVoiceOpen, isBackupModalOpen, showCashModal, isMobileMoreOpen]);

  // Synchronize documentElement theme class with current session state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
  }, [theme]);

  const handleRefresh = async () => {
    const wsId = activeWorkspaceId || '00000000-0000-0000-0000-000000000010';
    await syncEngine.pullAll(wsId);
  };

  // 1. Initial Authentication Check Loading State
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-slate-50' : 'bg-[#070a12]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center font-black text-sm text-white shadow-xl shadow-indigo-600/30 animate-pulse">
            RB
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span>Verifying secure session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Strict Authentication Guard: If not signed in, show ONLY LoginPage
  // Absolutely no app module (Navbar, Sidebar, Dashboard, Cash, Expenses, Dues, Cards, Sheets, Notes, Vault, Reports) is rendered!
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 relative ${
        isLight ? 'bg-slate-50 modern-mesh-light text-slate-900' : 'bg-[#090d16] modern-mesh-dark text-slate-100'
      }`}
    >
      {/* Biometric / PIN App Lock Overlay */}
      <AppLockScreen />

      <Navbar
        onOpenAskAI={() => setIsAskAIOpen(true)}
        onRefresh={handleRefresh}
        onOpenBackupRestore={() => setIsBackupModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenBackupRestore={() => setIsBackupModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardScreen
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenAskAI={() => setIsAskAIOpen(true)}
              onQuickCashIn={() => setShowCashModal('in')}
              onQuickCashOut={() => setShowCashModal('out')}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenVoice={() => setIsVoiceOpen(true)}
            />
          )}
          {activeTab === 'cash' && <CashScreen />}
          {activeTab === 'expenses' && (
            <ExpensesScreen
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenVoice={() => setIsVoiceOpen(true)}
              onOpenQuickExpense={() => setShowCashModal('out')}
            />
          )}
          {activeTab === 'dues' && <DuesScreen />}
          {activeTab === 'cards' && <CardsScreen />}
          {activeTab === 'sheets' && <SheetsScreen />}
          {activeTab === 'notes' && <NotesScreen />}
          {activeTab === 'vault' && <VaultScreen />}
          {activeTab === 'reports' && (
            <ReportsScreen onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
        </main>
      </div>

      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMore={() => setIsMobileMoreOpen(true)}
      />

      {/* Ask AI Modal */}
      {isAskAIOpen && (
        <AskAIModal
          isOpen={isAskAIOpen}
          onClose={() => setIsAskAIOpen(false)}
          onOpenScanner={() => {
            setIsAskAIOpen(false);
            setIsScannerOpen(true);
          }}
          onOpenVoice={() => {
            setIsAskAIOpen(false);
            setIsVoiceOpen(true);
          }}
        />
      )}

      {/* Receipt Scanner Modal */}
      {isScannerOpen && (
        <ReceiptScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Voice Expense Modal */}
      {isVoiceOpen && (
        <VoiceExpenseModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
        />
      )}

      {/* Mobile More Sheet - Android Material 3 Bottom Sheet */}
      {isMobileMoreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250"
            style={{
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                All Modules & Tools
              </span>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => {
                  setActiveTab('expenses');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all flex flex-col items-center gap-1.5 ${
                  activeTab === 'expenses'
                    ? 'border-rose-500 bg-rose-500/25 text-rose-600 dark:text-rose-300 ring-2 ring-rose-500'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span className="text-xl">📉</span>
                <span>Expenses</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('sheets');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all flex flex-col items-center gap-1.5 ${
                  activeTab === 'sheets'
                    ? 'border-blue-500 bg-blue-500/25 text-blue-600 dark:text-blue-300 ring-2 ring-blue-500'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-xl">📊</span>
                <span>Registers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('notes');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all flex flex-col items-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'border-amber-500 bg-amber-500/25 text-amber-600 dark:text-amber-300 ring-2 ring-amber-500'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-xl">📝</span>
                <span>Notes</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('vault');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all flex flex-col items-center gap-1.5 ${
                  activeTab === 'vault'
                    ? 'border-violet-500 bg-violet-500/25 text-violet-600 dark:text-violet-300 ring-2 ring-violet-500'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-xl">🔐</span>
                <span>Vault</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all flex flex-col items-center gap-1.5 ${
                  activeTab === 'reports'
                    ? 'border-indigo-500 bg-indigo-500/25 text-indigo-600 dark:text-indigo-300 ring-2 ring-indigo-500'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-xl">📈</span>
                <span>Reports</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsScannerOpen(true);
                }}
                className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-center font-bold text-xs text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-1.5"
              >
                <span className="text-xl">📸</span>
                <span>Scan Bill</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsVoiceOpen(true);
                }}
                className="p-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-center font-bold text-xs text-indigo-600 dark:text-indigo-400 flex flex-col items-center gap-1.5"
              >
                <span className="text-xl">🎙️</span>
                <span>Voice</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsBackupModalOpen(true);
                }}
                className="p-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-center font-bold text-xs text-blue-600 dark:text-blue-400 flex flex-col items-center gap-1.5 col-span-2"
              >
                <span className="text-xl">🛡️</span>
                <span>Backup, Restore & App Lock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Backup, Restore & App Lock Modal */}
      {isBackupModalOpen && (
        <BackupRestoreModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
        />
      )}

      {/* Quick Transaction Modal (Inflow / Outflow / Expense) */}
      {showCashModal !== null && (
        <QuickTransactionModal
          isOpen={showCashModal !== null}
          type={showCashModal || 'out'}
          onClose={() => setShowCashModal(null)}
          onSubmit={({ amountPaise, categoryId, accountId, mode, note, entryDate, scope }) => {
            const newEntry: LedgerEntry = {
              id: crypto.randomUUID(),
              workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
              type: showCashModal === 'in' ? 'cash_in' : 'cash_out',
              amount: amountPaise,
              category_id: categoryId,
              cash_location_id: accountId,
              mode,
              scope: scope || 'business',
              note: note.trim() || (showCashModal === 'in' ? 'Cash Received' : 'Expense Recorded'),
              entry_date: entryDate,
            };
            syncEngine.pushLedgerEntry(newEntry);
            setShowCashModal(null);
          }}
        />
      )}

      {/* Supabase Authentication & Local Data Migration Modal */}
      <AuthModal />

      {/* Role-Aware Workspace Membership Modal */}
      <WorkspaceMembersModal />
    </div>
  );
}
