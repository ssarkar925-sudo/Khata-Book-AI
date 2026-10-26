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
    { id: 'dashboard' as TabType, label: 'Overview', icon: LayoutDashboard },
    { id: 'cash' as TabType, label: 'Bank & Accounts', icon: Wallet },
    { id: 'dues' as TabType, label: 'Dues & Udhar', icon: Users, badge: pendingDuesCount || undefined },
    { id: 'cards' as TabType, label: 'Credit Cards', icon: CreditCard, badge: activeCardsCount || undefined },
    { id: 'notes' as TabType, label: 'Daily Notes', icon: StickyNote },
    { id: 'vault' as TabType, label: 'Encrypted Vault', icon: Lock },
    { id: 'reports' as TabType, label: 'Reports & Tax', icon: FileSpreadsheet },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-56 border-r p-3 space-y-1 select-none transition-colors ${
        isLight
          ? 'bg-zinc-50/50 border-zinc-200 text-zinc-800'
          : 'bg-[#09090b] border-zinc-800/80 text-zinc-200'
      }`}
    >
      <div className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 py-1.5">
        Modules
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-medium text-xs transition-colors ${
              isActive
                ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="w-3.5 h-3.5 opacity-70" />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
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
