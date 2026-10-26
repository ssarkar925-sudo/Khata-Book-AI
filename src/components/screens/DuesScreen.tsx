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
import { syncEngine } from '@/lib/syncEngine';
import { ContactDetailModal } from '@/components/modals/ContactDetailModal';

export function DuesScreen() {
  const { customers, dues, addCustomerOptimistic, addDueOptimistic, updateDueStatusOptimistic } = useCustomerStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [selectedCustForDetail, setSelectedCustForDetail] = useState<Customer | null>(null);
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

    syncEngine.pushCustomer(newCust);
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

    syncEngine.pushDue(newDue);
    setShowAddDueModal(false);
    setDueAmountRupees('');
    setDueNotes('');
  };

  const pendingDues = dues.filter((d) => d.status === 'pending');
  const totalReceivables = pendingDues
    .filter((d) => d.direction === 'you_will_get')
    .reduce((s, d) => s + Number(d.amount), 0);
  const totalPayables = pendingDues
    .filter((d) => d.direction === 'you_will_give')
    .reduce((s, d) => s + Number(d.amount), 0);

  // Color generator for customer initials avatar
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-teal-400 to-emerald-600',
      'from-purple-500 to-pink-500',
      'from-amber-400 to-orange-500',
      'from-rose-500 to-red-600',
      'from-cyan-400 to-blue-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
              <Users className="w-5 h-5" />
            </div>
            <span>Dues & Udhar Book</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track receivables (You Will Get), payables (You Will Give), and dispatch one-tap WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>

          <button
            onClick={() => {
              if (customers.length > 0) setSelectedCustId(customers[0].id);
              setShowAddDueModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-white text-xs shadow-lg shadow-cyan-500/25 transition-all hover-lift touch-press"
          >
            <Plus className="w-4 h-4" />
            <span>Record Due (Udhar)</span>
          </button>
        </div>
      </div>

      {/* Dual Summary Banners (Receivables vs Payables) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Receivables Banner */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border border-emerald-500/25 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Total You Will Get
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 tabular-nums">
            +{formatPaise(totalReceivables)}
          </div>
          <span className="text-xs text-slate-300 mt-1 inline-block">
            Expected from credit customers
          </span>
        </div>

        {/* Payables Banner */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-rose-950 via-slate-900 to-red-950 text-white border border-rose-500/25 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Total You Will Give
            </span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-400 tabular-nums">
            -{formatPaise(totalPayables)}
          </div>
          <span className="text-xs text-slate-300 mt-1 inline-block">
            Pending payments to suppliers & vendors
          </span>
        </div>
      </div>

      {/* Dues List */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Active Due Records ({pendingDues.length})
          </h3>
          <span className="text-xs font-bold text-slate-400">
            {customers.length} total contacts
          </span>
        </div>

        {pendingDues.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">No pending dues recorded.</p>
            <p className="text-[11px] text-slate-400">All customer and supplier accounts are fully settled.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {pendingDues.map((due) => {
              const cust = customers.find((c) => c.id === due.customer_id);
              const isGet = due.direction === 'you_will_get';
              const nameInitial = (cust?.name || 'C').charAt(0).toUpperCase();

              return (
                <div key={due.id} className="py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-white/5 px-2 rounded-2xl transition-colors">
                  <div
                    onClick={() => cust && setSelectedCustForDetail(cust)}
                    className="flex items-center gap-3 cursor-pointer group"
                    title="Click to view full contact statement"
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(cust?.name || 'Customer')} flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      {nameInitial}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {cust?.name || 'Contact'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        {cust?.phone && <span className="font-semibold text-slate-500">📞 {cust.phone}</span>}
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isGet ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {isGet ? 'You Will Get' : 'You Will Give'}
                      </span>
                    </div>

                    {/* WhatsApp Reminder Button */}
                    {cust?.phone && isGet && (
                      <a
                        href={`https://wa.me/91${cust.phone}?text=Dear%20${encodeURIComponent(
                          cust.name
                        )},%20this%20is%20a%20gentle%20reminder%20regarding%20pending%20balance%20of%20Rs.%20${(
                          due.amount / 100
                        ).toFixed(2)}.%20Thank%20you!`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send WhatsApp Reminder"
                        className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                    )}

                    {/* Settle Button */}
                    <button
                      onClick={() => syncEngine.updateDueStatus(due.id, 'settled')}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors"
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

      {/* Modal: New Contact */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Contact / Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mobile / WhatsApp Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/25"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Due */}
      {showAddDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Due (Udhar Entry)</h3>
              <button onClick={() => setShowAddDueModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Select Contact</label>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_get')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      dueDirection === 'you_will_get'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                        : 'border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    You Will Get (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_give')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      dueDirection === 'you_will_give'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-400'
                        : 'border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    You Will Give (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={dueAmountRupees}
                  onChange={(e) => setDueAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 5 bags of cement, shop grocery"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/25"
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Contact Detail Statement Popup */}
      <ContactDetailModal
        customer={selectedCustForDetail}
        onClose={() => setSelectedCustForDetail(null)}
        onRecordDue={() => {
          if (selectedCustForDetail) setSelectedCustId(selectedCustForDetail.id);
          setShowAddDueModal(true);
        }}
      />
    </div>
  );
}
