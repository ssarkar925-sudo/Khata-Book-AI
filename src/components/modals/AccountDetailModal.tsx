'use client';

import React, { useState } from 'react';
import {
  X,
  Building,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Share2,
  Edit3,
  Trash2,
  Calendar,
  Wallet,
  Receipt,
  FileText,
} from 'lucide-react';
import { CashLocation, LedgerEntry } from '@/types';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { getCategoryById } from '@/lib/categories';

interface AccountDetailModalProps {
  account: CashLocation | null;
  onClose: () => void;
  onTransfer: () => void;
  onEdit?: (account: CashLocation) => void;
  onDelete?: (id: string) => void;
}

export function AccountDetailModal({
  account,
  onClose,
  onTransfer,
  onEdit,
  onDelete,
}: AccountDetailModalProps) {
  const { entries: ledger } = useLedgerStore();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');

  if (!account) return null;

  // Filter ledger entries for this account
  const accountEntries = ledger
    .filter((e) => e.cash_location_id === account.id)
    .filter((e) => {
      if (filterType === 'in') return e.type === 'cash_in';
      if (filterType === 'out') {
        return (
          e.type === 'cash_out' ||
          e.type === 'expense' ||
          e.type === 'bill_payment'
        );
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.entry_date || b.created_at || 0).getTime() -
        new Date(a.entry_date || a.created_at || 0).getTime()
    );

  const totalCredits = ledger
    .filter((e) => e.cash_location_id === account.id && e.type === 'cash_in')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalDebits = ledger
    .filter(
      (e) =>
        e.cash_location_id === account.id &&
        (e.type === 'cash_out' ||
          e.type === 'expense' ||
          e.type === 'bill_payment')
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const getAccountTypeLabel = (type?: string) => {
    switch (type) {
      case 'savings':
        return 'Savings Account';
      case 'current':
        return 'Current Account';
      case 'cash_counter':
        return 'Physical Cash Drawer';
      case 'wallet':
        return 'Digital Wallet / UPI';
      case 'od_cc':
        return 'Overdraft / CC Account';
      default:
        return 'Bank Account';
    }
  };

  const handleSharePassbook = () => {
    let msg = `🏛️ *${account.name}* — Account Statement\n`;
    if (account.bank_name) msg += `Bank: ${account.bank_name}\n`;
    if (account.account_number_last4)
      msg += `A/C Ending: •••• ${account.account_number_last4}\n`;
    msg += `Type: ${getAccountTypeLabel(account.account_type)}\n`;
    msg += `------------------------------\n`;
    msg += `💰 *Current Balance:* ${formatPaise(account.balance)}\n`;
    msg += `🟢 *Total Credits:* ${formatPaise(totalCredits)}\n`;
    msg += `🔴 *Total Debits:* ${formatPaise(totalDebits)}\n`;
    msg += `------------------------------\n`;
    msg += `*Recent Transactions (${Math.min(5, accountEntries.length)}):*\n`;

    accountEntries.slice(0, 5).forEach((tx) => {
      const isIn = tx.type === 'cash_in';
      const cat = getCategoryById(tx.category_id);
      const sign = isIn ? '+' : '-';
      msg += `• ${new Date(tx.entry_date).toLocaleDateString()}: ${sign}${formatPaise(
        tx.amount
      )} (${tx.note || cat.name}) via ${tx.mode.toUpperCase()}\n`;
    });

    msg += `\n_Generated via Record Book_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/25">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  {account.name}
                </h3>
                {account.is_default && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    Primary
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {account.bank_name || 'Bank Account'}
                {account.account_number_last4
                  ? ` •••• ${account.account_number_last4}`
                  : ''}{' '}
                • {getAccountTypeLabel(account.account_type)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSharePassbook}
              title="Share Passbook via WhatsApp"
              className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(account);
                }}
                title="Edit Account Details"
                className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {onDelete && !account.is_default && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Are you sure you want to delete ${account.name}? Linked transactions will remain in ledger.`
                    )
                  ) {
                    onClose();
                    onDelete(account.id);
                  }
                }}
                title="Delete Account"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Hero Balance & Flow Cards */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border border-indigo-500/20 shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                Available Liquid Balance
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Ready to Spend
              </span>
            </div>

            <div className="text-3xl font-black tracking-tight text-white tabular-nums">
              {formatPaise(account.balance)}
            </div>

            {/* Micro in/out counters */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Total
                  Deposits
                </span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +{formatPaise(totalCredits)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-rose-400" /> Total
                  Withdrawals
                </span>
                <span className="font-bold text-rose-400 tabular-nums">
                  -{formatPaise(totalDebits)}
                </span>
              </div>
            </div>
          </div>

          {/* Passbook / Statement Filter Tabs */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Passbook Statement ({accountEntries.length})
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('in')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterType === 'in'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                In (+)
              </button>
              <button
                onClick={() => setFilterType('out')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterType === 'out'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Out (-)
              </button>
            </div>
          </div>

          {/* Passbook Transactions List */}
          <div className="space-y-2">
            {accountEntries.length === 0 ? (
              <div className="text-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-xs text-slate-400 space-y-1.5">
                <Receipt className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">
                  No passbook entries recorded yet
                </p>
                <p className="text-[10px]">
                  When you record income, expenses, or transfer funds using this
                  account, they will appear here.
                </p>
              </div>
            ) : (
              accountEntries.map((tx) => {
                const isInflow = tx.type === 'cash_in';
                const cat = getCategoryById(tx.category_id);

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isInflow
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isInflow ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {tx.note || cat.name}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-300 uppercase">
                            {tx.mode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>
                            {new Date(tx.entry_date).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>{cat.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-black tabular-nums ${
                          isInflow
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isInflow ? '+' : '-'}
                        {formatPaise(tx.amount)}
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {isInflow ? 'Deposit' : 'Debit'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2 shrink-0">
          <button
            onClick={() => {
              onClose();
              onTransfer();
            }}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/25 transition-all hover-lift touch-press"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer Funds</span>
          </button>
        </div>
      </div>
    </div>
  );
}
