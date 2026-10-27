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
import { X, Camera, Mic, Shield } from 'lucide-react';

// Dynamic Code Splitting for ultra-fast startup
const DashboardScreen = dynamic(
  () => import('@/components/screens/DashboardScreen').then((m) => m.DashboardScreen)
);
const CashScreen = dynamic(() => import('@/components/screens/CashScreen').then((m) => m.CashScreen));
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

export function AppShell() {
  const { user, authLoading, theme, activeWorkspaceId, setWorkspaces, setActiveWorkspaceId, setSyncStatus, setUser } = useSessionStore();
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

  useEffect(() => {
    // Supabase auth subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  // Cloud Sync & Realtime Engine
  useEffect(() => {
    const wsId = activeWorkspaceId || '00000000-0000-0000-0000-000000000010';
    syncEngine.pullAll(wsId);
    syncEngine.subscribeRealtime(wsId);

    return () => {
      syncEngine.destroy();
    };
  }, [activeWorkspaceId]);

  const handleRefresh = async () => {
    const wsId = activeWorkspaceId || '00000000-0000-0000-0000-000000000010';
    await syncEngine.pullAll(wsId);
  };

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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
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
          {activeTab === 'dues' && <DuesScreen />}
          {activeTab === 'cards' && <CardsScreen />}
          {activeTab === 'sheets' && <SheetsScreen />}
          {activeTab === 'notes' && <NotesScreen />}
          {activeTab === 'vault' && <VaultScreen />}
          {activeTab === 'reports' && <ReportsScreen />}
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

      {/* Mobile More Sheet */}
      {isMobileMoreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xl"
          >
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                More Tools
              </span>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsScannerOpen(true);
                }}
                className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-center font-bold text-xs text-emerald-600 dark:text-emerald-400"
              >
                📸 Scan Bill
              </button>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsVoiceOpen(true);
                }}
                className="p-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-center font-bold text-xs text-indigo-600 dark:text-indigo-400"
              >
                🎙️ Voice Entry
              </button>
              <button
                onClick={() => {
                  setActiveTab('sheets');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center font-bold text-xs text-slate-800 dark:text-slate-200"
              >
                📊 Sheets
              </button>
              <button
                onClick={() => {
                  setActiveTab('vault');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center font-bold text-xs text-slate-800 dark:text-slate-200"
              >
                🔐 Vault
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center font-bold text-xs text-slate-800 dark:text-slate-200"
              >
                📈 Reports
              </button>
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsBackupModalOpen(true);
                }}
                className="p-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-center font-bold text-xs text-blue-600 dark:text-blue-400"
              >
                🛡️ Backup & Lock
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
          onSubmit={({ amountPaise, categoryId, accountId, mode, note, entryDate }) => {
            const newEntry: LedgerEntry = {
              id: crypto.randomUUID(),
              workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
              type: showCashModal === 'in' ? 'cash_in' : 'cash_out',
              amount: amountPaise,
              category_id: categoryId,
              cash_location_id: accountId,
              mode,
              note: note.trim() || (showCashModal === 'in' ? 'Cash Received' : 'Expense Recorded'),
              entry_date: entryDate,
            };
            syncEngine.pushLedgerEntry(newEntry);
            setShowCashModal(null);
          }}
        />
      )}
    </div>
  );
}
