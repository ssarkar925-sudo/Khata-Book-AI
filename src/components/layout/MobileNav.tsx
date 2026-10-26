'use client';

import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  CreditCard,
  StickyNote,
  MoreHorizontal,
} from 'lucide-react';
import { TabType } from '@/types';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSessionStore } from '@/stores/useSessionStore';

interface MobileNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenMore: () => void;
}

export function MobileNav({ activeTab, setActiveTab, onOpenMore }: MobileNavProps) {
  const { dues } = useCustomerStore();
  const { theme } = useSessionStore();
  const isLight = theme === 'light';

  const pendingDuesCount = dues.filter((d) => d.status === 'pending').length;

  const items: {
    id: TabType;
    label: string;
    icon: React.ElementType;
    badge?: number;
    color: string;
    activeText: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
      activeText: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'cash',
      label: 'Banks',
      icon: Wallet,
      color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      activeText: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'dues',
      label: 'Dues',
      icon: Users,
      badge: pendingDuesCount || undefined,
      color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
      activeText: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'cards',
      label: 'Cards',
      icon: CreditCard,
      color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
      activeText: 'text-purple-600 dark:text-purple-400',
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: StickyNote,
      color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      activeText: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 transition-colors border-t glass-panel ${
        isLight
          ? 'bg-white/90 border-slate-200/90 text-slate-600 shadow-[0_-8px_25px_rgba(0,0,0,0.06)]'
          : 'bg-[#0f172a]/90 border-white/10 text-slate-300 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]'
      }`}
      style={{
        paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom, 0px))',
        paddingTop: '0.35rem',
      }}
    >
      <div className="grid grid-cols-6 items-center px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-all touch-press ${
                isActive ? item.activeText + ' font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-11 h-7 rounded-xl transition-all ${
                  isActive ? item.color + ' scale-105 shadow-xs' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] bg-rose-500 text-white flex items-center justify-center font-bold ring-2 ring-white dark:ring-slate-900">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[9.5px] mt-0.5 tracking-tight truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-1 transition-all touch-press ${
            activeTab === 'vault' || activeTab === 'reports'
              ? 'text-violet-600 dark:text-violet-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <div
            className={`flex items-center justify-center w-11 h-7 rounded-xl transition-all ${
              activeTab === 'vault' || activeTab === 'reports'
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 scale-105'
                : 'bg-transparent'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <span className="text-[9.5px] mt-0.5 tracking-tight font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
