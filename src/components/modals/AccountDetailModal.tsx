'use client';

import React from 'react';
import {
  X,
  Building,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { CashLocation } from '@/types';
import { formatPaise } from '@/lib/money';

interface AccountDetailModalProps {
  account: CashLocation | null;
  onClose: () => void;
  onTransfer: () => void;
}

export function AccountDetailModal({ account, onClose, onTransfer }: AccountDetailModalProps) {
  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {account.name}
              </h3>
              <span className="text-[11px] text-slate-400">Personal Bank / Cash Counter</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Display */}
        <div className="text-center py-3 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent rounded-2xl border border-blue-500/20 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Current Balance</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            {formatPaise(account.balance)}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Fully Liquid & Available
          </span>
        </div>

        {/* Account Info List */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Is Default / Primary</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {account.is_default ? 'Yes (Primary Counter)' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Account ID</span>
            <span className="font-mono text-slate-400">{account.id.slice(0, 10)}...</span>
          </div>
        </div>

        {/* Quick Transfer Action */}
        <div className="pt-2">
          <button
            onClick={() => {
              onClose();
              onTransfer();
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover-lift touch-press"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer to Another Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
