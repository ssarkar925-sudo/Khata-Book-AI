'use client';

import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  CreditCard,
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
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cash' as TabType, label: 'Bank & Accounts', icon: Wallet },
    { id: 'dues' as TabType, label: 'Udhar Khata', icon: Users, badge: pendingDuesCount || undefined },
    { id: 'cards' as TabType, label: 'Credit Cards', icon: CreditCard, badge: activeCardsCount || undefined },
    { id: 'notes' as TabType, label: 'Daily Notes', icon: StickyNote },
    { id: 'vault' as TabType, label: 'Encrypted Vault', icon: Lock },
    { id: 'reports' as TabType, label: 'Reports & Tax', icon: FileSpreadsheet },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-64 border-r p-4 space-y-1.5 select-none transition-all ${
        isLight
          ? 'bg-white/70 border-slate-200/90 text-slate-800 backdrop-blur-xl'
          : 'bg-slate-950/70 border-white/10 text-white backdrop-blur-xl'
      }`}
    >
      <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 px-3 py-2">
        Financial Modules
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 touch-press ${
              isActive
                ? isLight
                  ? 'bg-emerald-500/15 text-emerald-800 font-bold border border-emerald-300 shadow-xs'
                  : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 font-bold border border-emerald-500/30 shadow-md shadow-emerald-950/40'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? 'text-emerald-500'
                    : isLight
                    ? 'text-slate-500'
                    : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-emerald-500 text-white'
                    : isLight
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-white/10 text-slate-300'
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
