'use client';

import React, { useState } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Check,
  Calendar,
  Share2,
  Edit3,
  Trash2,
  Building,
  User,
  Plus,
} from 'lucide-react';
import { Customer, PeopleDue } from '@/types';
import { formatPaise } from '@/lib/money';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { WhatsAppReminderModal } from '@/components/modals/WhatsAppReminderModal';

interface ContactDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  onRecordDue: () => void;
  onSettleDue: (due: PeopleDue, customer: Customer) => void;
  onEditContact?: (customer: Customer) => void;
  onDeleteContact?: (id: string) => void;
}

export function ContactDetailModal({
  customer,
  onClose,
  onRecordDue,
  onSettleDue,
  onEditContact,
  onDeleteContact,
}: ContactDetailModalProps) {
  const { dues } = useCustomerStore();
  const [isReminderOpen, setIsReminderOpen] = useState(false);

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
  const isSupplier = customer.type === 'supplier';

  const primaryDue: PeopleDue | null = pendingDues[0] || (netBalance > 0 ? {
    id: `due-net-${customer.id}`,
    workspace_id: customer.workspace_id,
    customer_id: customer.id,
    amount: Math.abs(netBalance),
    direction: 'you_will_get',
    due_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    notes: 'Net Outstanding Balance',
    scope: customer.scope || 'business',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : null);

  const handleShareStatement = () => {
    let msg = `📋 *Khata Statement — ${customer.name}*\n`;
    if (customer.phone) msg += `Phone: ${customer.phone}\n`;
    msg += `Type: ${isSupplier ? '🏭 Supplier / Vendor' : '👥 Customer'}\n`;
    msg += `------------------------------\n`;
    msg += `🟢 *You Will Pay Me:* ${formatPaise(totalGet)}\n`;
    msg += `🔴 *I Will Pay You:* ${formatPaise(totalGive)}\n`;
    msg += `📊 *Net Pending Balance:* ${
      netBalance >= 0 ? '+' : '-'
    }${formatPaise(Math.abs(netBalance))}\n`;
    msg += `------------------------------\n`;
    msg += `*Transaction Details (${contactDues.length}):*\n`;

    contactDues.slice(0, 8).forEach((d) => {
      const isGet = d.direction === 'you_will_get';
      const statusIcon = d.status === 'settled' ? '✅' : '⏳';
      msg += `• ${statusIcon} ${new Date(d.due_date).toLocaleDateString()}: ${
        isGet ? '+' : '-'
      }${formatPaise(d.amount)} (${d.notes || (isGet ? 'Udhar Given' : 'Bill Owed')}) [${d.status.toUpperCase()}]\n`;
    });

    msg += `\n_Generated via Record Book_`;

    const encoded = encodeURIComponent(msg);
    const targetUrl = customer.phone
      ? `https://wa.me/91${customer.phone.replace(/\D/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-cyan-500/25">
              {nameInitial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  {customer.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {isSupplier ? 'Supplier' : 'Customer'}
                </span>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                {customer.phone ? `📞 ${customer.phone}` : 'No phone saved'}
                {customer.address && ` • 📍 ${customer.address}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleShareStatement}
              title="Share Statement via WhatsApp"
              className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {onEditContact && (
              <button
                onClick={() => {
                  onClose();
                  onEditContact(customer);
                }}
                title="Edit Contact Details"
                className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {onDeleteContact && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Are you sure you want to delete ${customer.name}? All linked due records will be removed.`
                    )
                  ) {
                    onClose();
                    onDeleteContact(customer.id);
                  }
                }}
                title="Delete Contact"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Dual Balance Banners */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                You Will Get
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatPaise(totalGet)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                You Will Give
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                -{formatPaise(totalGive)}
              </div>
            </div>
          </div>

          {/* Action Buttons: WhatsApp & Record Due */}
          <div className="flex gap-2 shrink-0">
            {primaryDue ? (
              <button
                onClick={() => setIsReminderOpen(true)}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all hover-lift"
              >
                <MessageSquare className="w-4 h-4" />
                <span>UPI Reminder &amp; Bill</span>
              </button>
            ) : (
              <button
                onClick={handleShareStatement}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all hover-lift"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Share Statement</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onRecordDue();
              }}
              className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all hover-lift"
            >
              <Plus className="w-4 h-4" />
              <span>Add Due / Udhar</span>
            </button>
          </div>

          {/* Running Khata History with this Contact */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Khata History ({contactDues.length})
              </span>
              <span className="text-[11px] text-slate-400">
                {pendingDues.length} pending
              </span>
            </div>

            {contactDues.length === 0 ? (
              <div className="text-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-xs text-slate-400">
                No entries recorded for this contact yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5 space-y-1">
                {contactDues.map((due) => {
                  const isGet = due.direction === 'you_will_get';
                  const isPending = due.status === 'pending';

                  return (
                    <div
                      key={due.id}
                      className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-white/5 px-2 rounded-xl transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{due.notes || (isGet ? 'Credit given (Udhar)' : 'Payment owed')}</span>
                        </div>
                        {due.notes && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
                            <span>📝 Remark: {due.notes}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Due: {new Date(due.due_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span
                            className={
                              isPending
                                ? 'text-amber-500 font-bold'
                                : 'text-emerald-500 font-bold'
                            }
                          >
                            {due.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={`font-black text-sm tabular-nums ${
                            isGet
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isGet ? '+' : '-'}
                          {formatPaise(due.amount)}
                        </div>

                        {isPending && (
                          <button
                            onClick={() => {
                              onClose();
                              onSettleDue(due, customer);
                            }}
                            className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors"
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

      {primaryDue && (
        <WhatsAppReminderModal
          isOpen={isReminderOpen}
          onClose={() => setIsReminderOpen(false)}
          due={primaryDue}
          customer={customer}
        />
      )}
    </div>
  );
}
