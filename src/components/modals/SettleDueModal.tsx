'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Wallet,
  Coins,
  Smartphone,
  Landmark,
  Building,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { PeopleDue, Customer, PaymentMode } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useAccountStore } from '@/stores/useAccountStore';
import { syncEngine } from '@/lib/syncEngine';

interface SettleDueModalProps {
  isOpen: boolean;
  due: PeopleDue | null;
  customer?: Customer | null;
  onClose: () => void;
}

export function SettleDueModal({
  isOpen,
  due,
  customer,
  onClose,
}: SettleDueModalProps) {
  const { accounts } = useAccountStore();

  const [settleAmountRupees, setSettleAmountRupees] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts[0]?.id || ''
  );
  const [selectedMode, setSelectedMode] = useState<PaymentMode>('upi');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (isOpen && due) {
      setSettleAmountRupees(paiseToRupees(due.amount).toString());
      setRemark('');
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    }
  }, [isOpen, due, accounts]);

  if (!isOpen || !due) return null;

  const isReceivable = due.direction === 'you_will_get';
  const totalDuePaise = due.amount;
  const settleAmountPaise = parseToPaise(settleAmountRupees);
  const isFullSettlement = settleAmountPaise >= totalDuePaise;
  const remainingPaise = Math.max(0, totalDuePaise - settleAmountPaise);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settleAmountPaise <= 0) return;

    await syncEngine.settleDue(
      due.id,
      settleAmountPaise,
      selectedMode,
      selectedAccountId || undefined,
      remark.trim() || undefined
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isReceivable
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/25'
                  : 'bg-gradient-to-tr from-rose-500 to-red-500 shadow-rose-500/25'
              }`}
            >
              {isReceivable ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {isReceivable ? 'Receive Payment' : 'Pay Pending Balance'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {customer?.name || 'Contact'} • Total Pending:{' '}
                <span className="font-bold">{formatPaise(totalDuePaise)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Settle Amount Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Settling Amount (₹)
              </label>
              <button
                type="button"
                onClick={() =>
                  setSettleAmountRupees(paiseToRupees(totalDuePaise).toString())
                }
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Full Settle ({formatPaise(totalDuePaise)})
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                autoFocus
                placeholder="0.00"
                value={settleAmountRupees}
                onChange={(e) => setSettleAmountRupees(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xl font-black text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Partial Settlement Info */}
            {!isFullSettlement && settleAmountPaise > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                <span>Partial Payment:</span>
                <span className="font-bold">
                  Remaining Due: {formatPaise(remainingPaise)}
                </span>
              </div>
            )}
          </div>

          {/* Destination / Source Bank Account */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isReceivable ? 'Deposit Money Into' : 'Pay Money From'}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="dark:bg-slate-900">
                  {acc.name} — Balance: {formatPaise(acc.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'upi', label: 'UPI / QR', icon: <Smartphone className="w-3.5 h-3.5" /> },
                { id: 'cash', label: 'Cash', icon: <Coins className="w-3.5 h-3.5" /> },
                { id: 'bank', label: 'Bank Transfer', icon: <Landmark className="w-3.5 h-3.5" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id as PaymentMode)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                    selectedMode === m.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Remark / Receipt Note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Remark / Receipt Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. GPay Ref #4829, Cash handed over"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex gap-2 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settleAmountPaise <= 0}
              className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 ${
                isReceivable
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/25'
              }`}
            >
              {isFullSettlement
                ? `Confirm Settlement (${formatPaise(settleAmountPaise)})`
                : `Save Partial (${formatPaise(settleAmountPaise)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
