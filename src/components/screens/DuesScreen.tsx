'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  MessageSquare,
  Check,
  X,
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            <span>Dues & Credit Ledger</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track receivables (You Will Get) and payables (You Will Give).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 font-medium text-xs text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>

          <button
            onClick={() => {
              if (customers.length > 0) setSelectedCustId(customers[0].id);
              setShowAddDueModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Due</span>
          </button>
        </div>
      </div>

      {/* Dues List */}
      <div
        className={`rounded-xl border p-4 sm:p-5 transition-colors ${
          isLight ? 'bg-white border-zinc-200' : 'bg-[#121215] border-zinc-800/80'
        }`}
      >
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            Pending Dues ({pendingDues.length})
          </h3>
          <span className="text-xs text-zinc-400 font-mono">{customers.length} contacts</span>
        </div>

        {pendingDues.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-400 space-y-1">
            <p>No pending dues recorded.</p>
            <p className="text-[11px] text-zinc-500">All customer and supplier dues are currently settled.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {pendingDues.map((due) => {
              const cust = customers.find((c) => c.id === due.customer_id);
              const isGet = due.direction === 'you_will_get';

              return (
                <div key={due.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isGet ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {cust?.name || 'Contact'}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                        {cust?.phone && <span>{cust.phone}</span>}
                        {due.notes && <span>• {due.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`font-mono font-medium tabular-nums ${
                          isGet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isGet ? '+' : '-'}{formatPaise(due.amount)}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {isGet ? 'Receivable' : 'Payable'}
                      </span>
                    </div>

                    {/* WhatsApp Reminder Button */}
                    {cust?.phone && isGet && (
                      <a
                        href={`https://wa.me/91${cust.phone}?text=Hello%20${encodeURIComponent(
                          cust.name
                        )},%20this%20is%20a%20reminder%20regarding%20pending%20balance%20of%20Rs.%20${(
                          due.amount / 100
                        ).toFixed(2)}.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send WhatsApp Reminder"
                        className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Settle Button */}
                    <button
                      onClick={() => updateDueStatusOptimistic(due.id, 'settled')}
                      className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Settle</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Customer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">New Contact</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Due */}
      {showAddDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Record Due</h3>
              <button onClick={() => setShowAddDueModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDue} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Contact</label>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-zinc-900">
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_get')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      dueDirection === 'you_will_get'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    You Will Get (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_give')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      dueDirection === 'you_will_give'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    You Will Give (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={dueAmountRupees}
                  onChange={(e) => setDueAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rice bags, loan repayment"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
