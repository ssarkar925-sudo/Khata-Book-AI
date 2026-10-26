'use client';

import React from 'react';
import {
  X,
  Phone,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Check,
  Calendar,
} from 'lucide-react';
import { Customer, PeopleDue } from '@/types';
import { formatPaise } from '@/lib/money';
import { useCustomerStore } from '@/stores/useCustomerStore';

interface ContactDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  onRecordDue: () => void;
}

export function ContactDetailModal({ customer, onClose, onRecordDue }: ContactDetailModalProps) {
  const { dues, updateDueStatusOptimistic } = useCustomerStore();

  if (!customer) return null;

  const contactDues = dues.filter((d) => d.customer_id === customer.id);
  const pendingDues = contactDues.filter((d) => d.status === 'pending');

  const totalGet = pendingDues
    .filter((d) => d.direction === 'you_will_get')
    .reduce((s, d) => s + Number(d.amount), 0);

  const totalGive = pendingDues
    .filter((d) => d.direction === 'you_will_give')
    .reduce((s, d) => s + Number(d.amount), 0);

  const netBalance = totalGet - totalGive;

  const nameInitial = customer.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
              {nameInitial}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {customer.name}
              </h3>
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                {customer.phone ? `📞 ${customer.phone}` : 'No phone saved'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Net Running Balance Hero */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">You Will Get</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{formatPaise(totalGet)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">You Will Give</span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              -{formatPaise(totalGive)}
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp & Record Due */}
        <div className="flex gap-2 shrink-0">
          {customer.phone && totalGet > 0 && (
            <a
              href={`https://wa.me/91${customer.phone}?text=Hello%20${encodeURIComponent(
                customer.name
              )},%20this%20is%20a%20reminder%20that%20you%20have%20a%20pending%20balance%20of%20Rs.%20${(
                totalGet / 100
              ).toFixed(2)}.%20Kindly%20settle%20when%20convenient.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all hover-lift"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send WhatsApp Bill</span>
            </a>
          )}

          <button
            onClick={() => {
              onClose();
              onRecordDue();
            }}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all hover-lift"
          >
            <span>+ Add Due / Udhar</span>
          </button>
        </div>

        {/* Running Ledger History with this Contact */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Transaction History</span>
          {contactDues.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No entries recorded for this contact.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {contactDues.map((due) => {
                const isGet = due.direction === 'you_will_get';
                const isPending = due.status === 'pending';

                return (
                  <div key={due.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {due.notes || (isGet ? 'Credit given (Udhar)' : 'Payment owed')}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>Due: {new Date(due.due_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={isPending ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                          {due.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`font-black text-sm tabular-nums ${isGet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isGet ? '+' : '-'}{formatPaise(due.amount)}
                      </div>

                      {isPending && (
                        <button
                          onClick={() => updateDueStatusOptimistic(due.id, 'settled')}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-emerald-500 hover:text-white font-bold text-[10px] transition-colors"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
