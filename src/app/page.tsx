'use client';

import React, { useState, useEffect } from 'react';
import { TabType, LedgerEntry } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
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
import { parseToPaise } from '@/lib/money';
import { X } from 'lucide-react';

export default function HomePage() {
  const { user, authLoading, theme, activeWorkspaceId, setWorkspaces, setActiveWorkspaceId, setSyncStatus, setUser } = useSessionStore();
  const { addEntryOptimistic } = useLedgerStore();
  const isLight = theme === 'light';

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Quick transaction modals
  const [showCashModal, setShowCashModal] = useState<'in' | 'out' | null>(null);
  const [cashAmountRupees, setCashAmountRupees] = useState('');
  const [cashNote, setCashNote] = useState('');

  useEffect(() => {
    setMounted(true);

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

  // Workspace hydration
  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;

    async function loadWorkspaces() {
      setSyncStatus('syncing');
      try {
        const { data, error } = await supabase.from('workspaces').select('*');
        if (data && data.length > 0) {
          setWorkspaces(data);
          if (!activeWorkspaceId) setActiveWorkspaceId(data[0].id);
        } else {
          // If Supabase workspace table is connected, create record
          try {
            const { data: created } = await supabase.from('workspaces').insert({
              name: 'Primary Record Book',
              owner_id: currentUserId,
            }).select().single();
            if (created) {
              setWorkspaces([created]);
              setActiveWorkspaceId(created.id);
            }
          } catch {}
        }
        setSyncStatus('synced');
      } catch {
        // Safe offline / local fallback
        setSyncStatus('synced');
      }
    }

    loadWorkspaces();
  }, [user, activeWorkspaceId, setWorkspaces, setActiveWorkspaceId, setSyncStatus]);

  const handleRecordQuickCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(cashAmountRupees);
    if (paise <= 0 || !showCashModal || !user) return;

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId || crypto.randomUUID(),
      type: showCashModal === 'in' ? 'cash_in' : 'cash_out',
      amount: paise,
      mode: 'cash',
      note: cashNote.trim() || (showCashModal === 'in' ? 'Cash Received' : 'Cash Paid'),
      entry_date: new Date().toISOString(),
      created_by: user.id,
    };

    addEntryOptimistic(newEntry);
    setShowCashModal(null);
    setCashAmountRupees('');
    setCashNote('');

    // Background push to Supabase if available
    try {
      await supabase.from('ledger_entries').insert(newEntry);
    } catch {}
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#090d16] text-white'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-teal-400 flex items-center justify-center font-extrabold text-sm text-white shadow-lg shadow-indigo-500/30 animate-pulse">
            RB
          </div>
          <span className="text-xs font-semibold text-slate-400">Loading Record Book...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 relative ${
        isLight ? 'bg-slate-50 modern-mesh-light text-slate-900' : 'bg-[#090d16] modern-mesh-dark text-slate-100'
      }`}
    >
      <Navbar
        onOpenAskAI={() => setIsAskAIOpen(true)}
        onRefresh={() => {
          setSyncStatus('syncing');
          setTimeout(() => setSyncStatus('synced'), 400);
        }}
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
            />
          )}
          {activeTab === 'cash' && <CashScreen />}
          {activeTab === 'dues' && <DuesScreen />}
          {activeTab === 'cards' && <CardsScreen />}
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
      <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} />

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
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">More Tools</span>
              <button onClick={() => setIsMobileMoreOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setActiveTab('vault');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/40 text-left font-medium text-xs text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                🔐 Encrypted Vault
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/40 text-left font-medium text-xs text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                📊 Reports & Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Cash In / Out Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {showCashModal === 'in' ? 'Record Inflow (+)' : 'Record Outflow (-)'}
              </h3>
              <button onClick={() => setShowCashModal(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordQuickCash} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Amount (₹)</label>
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
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Note</label>
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
                    showCashModal === 'in' ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white' : 'bg-rose-600 hover:bg-rose-700'
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
