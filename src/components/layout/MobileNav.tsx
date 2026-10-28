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
  ];

  const isMoreActive =
    activeTab === 'expenses' ||
    activeTab === 'sheets' ||
    activeTab === 'notes' ||
    activeTab === 'vault' ||
    activeTab === 'reports';

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-colors border-t shadow-2xl ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-700 shadow-[0_-4px_25px_rgba(0,0,0,0.08)]'
          : 'bg-[#0f172a]/95 border-white/10 text-slate-200 shadow-[0_-4px_30px_rgba(0,0,0,0.6)]'
      }`}
      style={{
        paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom, 0px))',
        paddingTop: '0.35rem',
      }}
    >
      <div
        className="w-full items-center px-1"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-0.5 transition-all touch-press android-ripple ${
                isActive ? item.activeText + ' font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-all ${
                  isActive ? item.color + ' scale-100 shadow-xs' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-0.5 px-1 min-w-[16px] h-[16px] rounded-full text-[9px] bg-rose-500 text-white flex items-center justify-center font-bold ring-2 ring-white dark:ring-slate-900">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full px-0.5 font-bold">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Tab: Android Material More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-0.5 transition-all touch-press android-ripple ${
            isMoreActive
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium'
          }`}
        >
          <div
            className={`flex items-center justify-center w-14 h-8 rounded-full transition-all ${
              isMoreActive
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 scale-100 shadow-xs'
                : 'bg-transparent'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-bold">More</span>
        </button>
      </div>
    </nav>
  );
}
