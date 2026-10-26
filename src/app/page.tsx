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
import { LandingScreen } from '@/components/screens/LandingScreen';
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
          // Create default workspace
          const { data: created } = await supabase.from('workspaces').insert({
            name: 'Personal Khata & Records',
            owner_id: currentUserId,
          }).select().single();
          if (created) {
            setWorkspaces([created]);
            setActiveWorkspaceId(created.id);
          }
        }
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
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

    // Background push to Supabase
    try {
      await supabase.from('ledger_entries').insert(newEntry);
    } catch {}
  };

  if (!mounted || (authLoading && !user)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-slate-950 text-white'}`}>
        <div className="flex flex-col items-center gap-2 animate-pulse">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-bold text-white text-base">
            KB
          </div>
          <span className="text-xs font-semibold text-slate-400">Loading Khata Book AI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingScreen />;
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-250 relative ${
        isLight ? 'bg-slate-50 fintech-mesh-light text-slate-900' : 'bg-slate-950 fintech-mesh-dark text-slate-100'
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
          className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">More Modules</span>
              <button onClick={() => setIsMobileMoreOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setActiveTab('vault');
                  setIsMobileMoreOpen(false);
                }}
                className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 text-left font-bold text-xs"
              >
                🔐 Encrypted Vault
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setIsMobileMoreOpen(false);
                }}
                className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 text-left font-bold text-xs"
              >
                📊 Reports & Export
              </button>
            </div>

            <button
              onClick={() => {
                supabase.auth.signOut();
                setUser(null);
                setIsMobileMoreOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-xs"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Quick Cash In / Out Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {showCashModal === 'in' ? 'Record Cash In (+)' : 'Record Cash Out (-)'}
              </h3>
              <button onClick={() => setShowCashModal(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordQuickCash} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="e.g. 500"
                  value={cashAmountRupees}
                  onChange={(e) => setCashAmountRupees(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Customer payment, Tea expense"
                  value={cashNote}
                  onChange={(e) => setCashNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl font-bold text-xs text-white ${
                  showCashModal === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {showCashModal === 'in' ? 'Save Cash In' : 'Save Cash Out'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
