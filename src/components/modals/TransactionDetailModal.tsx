'use client';

import React from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Wallet,
  Tag,
  Trash2,
  Share2,
  Building,
  Smartphone,
  Coins,
  Landmark,
} from 'lucide-react';
import { LedgerEntry } from '@/types';
import { formatPaise } from '@/lib/money';
import { syncEngine } from '@/lib/syncEngine';
import { useAccountStore } from '@/stores/useAccountStore';
import { getCategoryById } from '@/lib/categories';

interface TransactionDetailModalProps {
  entry: LedgerEntry | null;
  onClose: () => void;
}

export function TransactionDetailModal({ entry, onClose }: TransactionDetailModalProps) {
  const { accounts } = useAccountStore();

  if (!entry) return null;

  const isInflow = entry.type === 'cash_in';
  const category = getCategoryById(entry.category_id);
  const linkedAccount = accounts.find((a) => a.id === entry.cash_location_id);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this transaction record? Linked bank account balance will be restored automatically.')) {
      syncEngine.deleteLedgerEntry(entry.id);
      onClose();
    }
  };

  const handleShareReceipt = () => {
    const text = `🧾 *Transaction Receipt — Record Book*\n` +
      `------------------------------\n` +
      `Amount: *${isInflow ? '+' : '-'}${formatPaise(entry.amount)}*\n` +
      `Type: ${isInflow ? '🟢 Cash Inflow / Income' : '🔴 Outflow / Expense'}\n` +
      `Category: ${category.name}\n` +
      (linkedAccount ? `Account: ${linkedAccount.name}\n` : '') +
      `Date: ${new Date(entry.entry_date).toLocaleDateString()}\n` +
      `Payment Mode: ${entry.mode.toUpperCase()}\n` +
      `Note: ${entry.note || 'None'}\n` +
      `------------------------------\n` +
      `_Recorded in Record Book_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isInflow
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/25'
                  : 'bg-gradient-to-tr from-rose-500 to-red-500 shadow-rose-500/25'
              }`}
            >
              {isInflow ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Transaction Details</h3>
              <span className="text-[10px] text-slate-400 font-mono">ID: {entry.id.slice(0, 8)}...</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Big Display */}
        <div className="text-center py-2 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Amount</span>
          <div
            className={`text-4xl font-black tabular-nums ${
              isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isInflow ? '+' : '-'}{formatPaise(entry.amount)}
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <span
              className={`inline-block text-[11px] font-bold px-3 py-0.5 rounded-full ${
                isInflow
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isInflow ? 'Cash Inflow' : 'Cash Outflow / Expense'}
            </span>

            <span
              className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: category.color + '15',
                color: category.color,
              }}
            >
              {category.name}
            </span>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3 text-xs">
          {/* Linked Bank/Cash Account */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> Account
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {linkedAccount ? linkedAccount.name : 'Unassigned Account'}
            </span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date & Time
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {new Date(entry.entry_date).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>

          {/* Payment Mode */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Mode of Payment
            </span>
            <span className="font-bold uppercase text-slate-800 dark:text-slate-200">
              {entry.mode}
            </span>
          </div>

          {/* Note / Description */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Note / Description
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
              {entry.note || 'None recorded'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleShareReceipt}
            className="flex-1 py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Receipt</span>
          </button>

          <button
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-2xl bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
