'use client';

import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  CreditCard,
  Table,
  StickyNote,
  Lock,
  FileSpreadsheet,
} from 'lucide-react';
import { TabType } from '@/types';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { dues } = useCustomerStore();
  const { cards } = useCardStore();
  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const pendingDuesCount = dues.filter((d) => d.status === 'pending').length;
  const activeCardsCount = cards.filter((c) => c.is_active).length;

  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Overview',
      icon: LayoutDashboard,
      color: 'from-indigo-500 to-blue-600',
      activeText: 'text-indigo-600 dark:text-indigo-300',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'cash' as TabType,
      label: 'Bank & Accounts',
      icon: Wallet,
      color: 'from-emerald-500 to-teal-600',
      activeText: 'text-emerald-600 dark:text-emerald-300',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'dues' as TabType,
      label: 'Dues & Udhar',
      icon: Users,
      badge: pendingDuesCount || undefined,
      color: 'from-cyan-500 to-blue-500',
      activeText: 'text-cyan-600 dark:text-cyan-300',
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'cards' as TabType,
      label: 'Credit Cards',
      icon: CreditCard,
      badge: activeCardsCount || undefined,
      color: 'from-purple-500 to-pink-600',
      activeText: 'text-purple-600 dark:text-purple-300',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'sheets' as TabType,
      label: 'Sheets & Registers',
      icon: Table,
      color: 'from-blue-600 to-cyan-600',
      activeText: 'text-blue-600 dark:text-blue-300',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'notes' as TabType,
      label: 'Daily Notes',
      icon: StickyNote,
      color: 'from-amber-500 to-orange-500',
      activeText: 'text-amber-600 dark:text-amber-300',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'vault' as TabType,
      label: 'Encrypted Vault',
      icon: Lock,
      color: 'from-violet-500 to-fuchsia-600',
      activeText: 'text-violet-600 dark:text-violet-300',
      iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      id: 'reports' as TabType,
      label: 'Reports & Tax',
      icon: FileSpreadsheet,
      color: 'from-blue-600 to-indigo-600',
      activeText: 'text-blue-600 dark:text-blue-300',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-64 border-r p-3.5 space-y-1.5 select-none transition-colors glass-panel ${
        isLight
          ? 'bg-white/60 border-slate-200/80 text-slate-800'
          : 'bg-[#0f172a]/60 border-white/10 text-slate-200'
      }`}
    >
      <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 px-3 py-1">
        Financial Hub
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-all touch-press ${
              isActive
                ? isLight
                  ? 'bg-slate-100 text-slate-900 shadow-xs border border-slate-200/90 font-bold'
                  : 'bg-white/10 text-white shadow-xs border border-white/10 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
                  isActive ? 'scale-105 ' + item.iconBg : item.iconBg
                }`}
              >
                <Icon className="w-4 h-4 stroke-[2]" />
              </div>
              <span className={isActive ? item.activeText : ''}>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-gradient-to-r ' + item.color + ' text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
