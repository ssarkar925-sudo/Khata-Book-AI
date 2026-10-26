'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  X,
  Phone,
} from 'lucide-react';
import { Customer, PeopleDue } from '@/types';
import { formatPaise, parseToPaise } from '@/lib/money';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSessionStore } from '@/stores/useSessionStore';

export function DuesScreen() {
  const { customers, dues, addCustomerOptimistic, addDueOptimistic, updateDueStatusOptimistic } = useCustomerStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddDueModal, setShowAddDueModal] = useState(false);

  // Add Customer State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Add Due State
  const [selectedCustId, setSelectedCustId] = useState('');
  const [dueAmountRupees, setDueAmountRupees] = useState('');
  const [dueDirection, setDueDirection] = useState<'you_will_get' | 'you_will_give'>('you_will_get');
  const [dueNotes, setDueNotes] = useState('');

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const newCust: Customer = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: custName.trim(),
      phone: custPhone.trim() || null,
      type: 'customer',
    };

    addCustomerOptimistic(newCust);
    setShowAddCustomerModal(false);
    setCustName('');
    setCustPhone('');
  };

  const handleCreateDue = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(dueAmountRupees);
    if (paise <= 0 || !selectedCustId) return;

    const newDue: PeopleDue = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      customer_id: selectedCustId,
      direction: dueDirection,
      amount: paise,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      notes: dueNotes.trim() || null,
    };

    addDueOptimistic(newDue);
    setShowAddDueModal(false);
    setDueAmountRupees('');
    setDueNotes('');
  };

  const pendingDues = dues.filter((d) => d.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            <span>Dues & Udhar Book (Customer & Supplier Records)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track who owes you money (*Receivables*), who you owe (*Payables*), and send WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 font-semibold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-all touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </button>

          <button
            onClick={() => {
              if (customers.length > 0) setSelectedCustId(customers[0].id);
              setShowAddDueModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 font-semibold text-white text-xs shadow-md shadow-teal-500/20 transition-all touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Record Due (Udhar)</span>
          </button>
        </div>
      </div>

      {/* Dues List */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
        }`}
      >
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">
          Pending Credit Records ({pendingDues.length})
        </h3>

        {pendingDues.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            No pending dues. All customer and supplier accounts are currently settled.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {pendingDues.map((due) => {
              const cust = customers.find((c) => c.id === due.customer_id);
              const isGet = due.direction === 'you_will_get';

              return (
                <div key={due.id} className="py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isGet ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {isGet ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {cust?.name || 'Customer'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        {cust?.phone && <span>📞 {cust.phone}</span>}
                        {due.notes && <span>• {due.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`font-black text-sm tabular-nums ${
                          isGet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isGet ? '+' : '-'}{formatPaise(due.amount)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {isGet ? 'You Will Get' : 'You Will Give'}
                      </span>
                    </div>

                    {/* WhatsApp Reminder Button */}
                    {cust?.phone && isGet && (
                      <a
                        href={`https://wa.me/91${cust.phone}?text=Dear%20${encodeURIComponent(
                          cust.name
                        )},%20this%20is%20a%20gentle%20reminder%20from%20our%20shop%20regarding%20pending%20balance%20of%20Rs.%20${(
                          due.amount / 100
                        ).toFixed(2)}.%20Thank%20you!`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send WhatsApp Reminder"
                        className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Settle Button */}
                    <button
                      onClick={() => updateDueStatusOptimistic(due.id, 'settled')}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-emerald-500/10 hover:text-emerald-500 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors"
                    >
                      Settle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: New Customer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Customer / Party</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mobile / WhatsApp Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                Save Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Due */}
      {showAddDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Credit / Udhar</h3>
              <button onClick={() => setShowAddDueModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Select Customer</label>
                {customers.length === 0 ? (
                  <p className="text-xs text-rose-500">Please add a customer first.</p>
                ) : (
                  <select
                    value={selectedCustId}
                    onChange={(e) => setSelectedCustId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_get')}
                    className={`py-2 rounded-xl border transition-all ${
                      dueDirection === 'you_will_get'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600'
                        : 'border-slate-200 dark:border-white/10 text-slate-400'
                    }`}
                  >
                    You Will Get
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_give')}
                    className={`py-2 rounded-xl border transition-all ${
                      dueDirection === 'you_will_give'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600'
                        : 'border-slate-200 dark:border-white/10 text-slate-400'
                    }`}
                  >
                    You Will Give
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1200"
                  value={dueAmountRupees}
                  onChange={(e) => setDueAmountRupees(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Note / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Goods purchase, Bill #402"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={customers.length === 0}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs"
              >
                Record Due
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
