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

  const items: { id: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'cash', label: 'Accounts', icon: Wallet },
    { id: 'dues', label: 'Dues', icon: Users, badge: pendingDuesCount || undefined },
    { id: 'cards', label: 'Cards', icon: CreditCard },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ];

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 mobile-dock transition-all ${
        isLight
          ? 'bg-white/90 border-slate-200/90 text-slate-700 shadow-[0_-8px_25px_rgba(0,0,0,0.06)]'
          : 'bg-slate-950/90 border-white/10 text-slate-300 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]'
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
              className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all touch-press ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : isLight
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 scale-105 shadow-xs shadow-emerald-500/20'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] bg-rose-500 text-white flex items-center justify-center font-bold shadow-sm ring-1 ring-white dark:ring-slate-900">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[9.5px] mt-0.5 tracking-tight truncate max-w-full px-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all touch-press ${
            activeTab === 'vault' || activeTab === 'reports'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : isLight
              ? 'text-slate-500 hover:text-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200 ${
              activeTab === 'vault' || activeTab === 'reports'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 scale-105 shadow-xs shadow-emerald-500/20'
                : 'bg-transparent'
            }`}
          >
            <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[9.5px] mt-0.5 tracking-tight font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
