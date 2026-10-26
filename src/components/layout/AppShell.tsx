'use client';

import React, { useState, useEffect } from 'react';
import { TabType, LedgerEntry } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AskAIModal } from '@/components/ai/AskAIModal';
import { DashboardScreen } from '@/components/screens/DashboardScreen';
import { CashScreen } from '@/components/screens/CashScreen';
import { DuesScreen } from '@/components/screens/DuesScreen';
import { CardsScreen } from '@/components/screens/CardsScreen';
import { NotesScreen } from '@/components/screens/NotesScreen';
import { VaultScreen } from '@/components/screens/VaultScreen';
import { ReportsScreen } from '@/components/screens/ReportsScreen';
import { SheetsScreen } from '@/components/screens/SheetsScreen';
import { ReceiptScannerModal } from '@/components/modals/ReceiptScannerModal';
import { VoiceExpenseModal } from '@/components/modals/VoiceExpenseModal';
import { parseToPaise } from '@/lib/money';
import { syncEngine } from '@/lib/syncEngine';
import { X, Camera, Mic } from 'lucide-react';

export function AppShell() {
  const { user, authLoading, theme, activeWorkspaceId, setWorkspaces, setActiveWorkspaceId, setSyncStatus, setUser } = useSessionStore();
  const { addEntryOptimistic } = useLedgerStore();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // Quick transaction modals
  const [showCashModal, setShowCashModal] = useState<'in' | 'out' | null>(null);
  const [cashAmountRupees, setCashAmountRupees] = useState('');
  const [cashNote, setCashNote] = useState('');

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

  const handleRecordQuickCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(cashAmountRupees);
    if (paise <= 0 || !showCashModal) return;

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
      type: showCashModal === 'in' ? 'cash_in' : 'cash_out',
      amount: paise,
      mode: 'cash',
      note: cashNote.trim() || (showCashModal === 'in' ? 'Cash Received' : 'Cash Paid'),
      entry_date: new Date().toISOString(),
    };

    syncEngine.pushLedgerEntry(newEntry);
    setShowCashModal(null);
    setCashAmountRupees('');
    setCashNote('');
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 relative ${
        isLight ? 'bg-slate-50 modern-mesh-light text-slate-900' : 'bg-[#090d16] modern-mesh-dark text-slate-100'
      }`}
    >
      <Navbar
        onOpenAskAI={() => setIsAskAIOpen(true)}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

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

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* Voice Expense Modal */}
      <VoiceExpenseModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />

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
            </div>
          </div>
        </div>
      )}

      {/* Quick Cash Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {showCashModal === 'in' ? 'Record Inflow (+)' : 'Record Outflow (-)'}
              </h3>
              <button
                onClick={() => setShowCashModal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordQuickCash} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={cashAmountRupees}
                  onChange={(e) => setCashAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-mono text-lg font-semibold focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Note
                </label>
                <input
                  type="text"
                  placeholder="Description..."
                  value={cashNote}
                  onChange={(e) => setCashNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(null)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg font-medium text-xs text-white transition-opacity ${
                    showCashModal === 'in'
                      ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
