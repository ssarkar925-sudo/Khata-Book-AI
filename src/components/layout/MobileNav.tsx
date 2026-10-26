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
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'cash', label: 'Accounts', icon: Wallet },
    { id: 'dues', label: 'Dues', icon: Users, badge: pendingDuesCount || undefined },
    { id: 'cards', label: 'Cards', icon: CreditCard },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ];

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 transition-colors border-t ${
        isLight
          ? 'bg-white/95 border-zinc-200 text-zinc-600 shadow-sm'
          : 'bg-[#0c0d0e]/95 border-zinc-800/80 text-zinc-400 shadow-sm'
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
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                isActive
                  ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-10 h-7 rounded-md transition-colors ${
                  isActive ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[13px] h-[13px] rounded-full text-[8.5px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-mono font-bold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            activeTab === 'vault' || activeTab === 'reports'
              ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <div
            className={`flex items-center justify-center w-10 h-7 rounded-md transition-colors ${
              activeTab === 'vault' || activeTab === 'reports'
                ? 'bg-zinc-100 dark:bg-zinc-800'
                : 'bg-transparent'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <span className="text-[9px] mt-0.5 tracking-tight font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
