'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MessageSquare,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Smartphone,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Customer, PeopleDue } from '@/types';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { useSessionStore } from '@/stores/useSessionStore';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  due: PeopleDue | null;
  customer: Customer | null;
}

type ReminderTone = 'gentle' | 'standard' | 'urgent';

export function WhatsAppReminderModal({
  isOpen,
  onClose,
  due,
  customer,
}: WhatsAppReminderModalProps) {
  const { workspaces, activeWorkspaceId } = useSessionStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  // Merchant Details
  const [businessName, setBusinessName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rb_merchant_name') || activeWs?.name || 'Record Book';
    }
    return activeWs?.name || 'Record Book';
  });

  const [upiId, setUpiId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rb_merchant_upi_id') || '';
    }
    return '';
  });

  const [tone, setTone] = useState<ReminderTone>('standard');
  const [copiedType, setCopiedType] = useState<'msg' | 'upi' | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (activeWs?.name && !localStorage.getItem('rb_merchant_name')) {
      setBusinessName(activeWs.name);
    }
  }, [activeWs]);

  const handleSaveMerchantConfig = (name: string, upi: string) => {
    setBusinessName(name);
    setUpiId(upi);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_merchant_name', name);
      localStorage.setItem('rb_merchant_upi_id', upi);
    }
  };

  const amountRupees = due ? paiseToRupees(due.amount).toFixed(2) : '0.00';
  const dueDateStr = due?.due_date ? new Date(due.due_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) : 'Immediate';

  // Construct standard UPI deep link compliant with NPCI specification
  const upiIntentUri = useMemo(() => {
    if (!upiId.trim() || !due) return '';
    const cleanUpi = upiId.trim();
    const cleanBiz = encodeURIComponent(businessName.trim() || 'Record Book');
    const cleanNote = encodeURIComponent(`Due settlement #${due.id.slice(0, 6)}`);
    return `upi://pay?pa=${cleanUpi}&pn=${cleanBiz}&am=${amountRupees}&cu=INR&tn=${cleanNote}`;
  }, [upiId, businessName, amountRupees, due]);

  // Generate Message
  const reminderMessage = useMemo(() => {
    if (!due || !customer) return '';
    const custName = customer.name.trim();
    const formattedAmt = formatPaise(due.amount);
    const remarkText = due.notes ? `\n📝 *Ref:* ${due.notes}` : '';
    const upiBlock = upiIntentUri
      ? `\n\n👉 *Pay Instantly via UPI (PhonePe / GPay / Paytm):*\n${upiIntentUri}`
      : upiId.trim()
      ? `\n\n👉 *UPI ID for Direct Payment:* \`${upiId.trim()}\``
      : '';

    if (tone === 'gentle') {
      return (
        `Dear *${custName}*,\n\n` +
        `Greetings from *${businessName}*! 🌸\n` +
        `This is a gentle reminder regarding your pending balance of *${formattedAmt}* scheduled for *${dueDateStr}*.${remarkText}` +
        `${upiBlock}\n\n` +
        `Kindly arrange the payment at your convenience. Thank you for your continued trust!`
      );
    }

    if (tone === 'urgent') {
      return (
        `⚠️ *FINAL PAYMENT NOTICE - ${businessName.toUpperCase()}*\n\n` +
        `Dear *${custName}*,\n` +
        `Your outstanding balance of *${formattedAmt}* due on *${dueDateStr}* is currently pending.${remarkText}` +
        `${upiBlock}\n\n` +
        `Please settle this immediately to avoid account hold or late charges. If already paid, kindly reply with the transaction reference. Thank you!`
      );
    }

    // Standard tone
    return (
      `*Payment Reminder - ${businessName}*\n\n` +
      `Dear *${custName}*,\n` +
      `This is to remind you about your outstanding due of *${formattedAmt}* with payment due on *${dueDateStr}*.${remarkText}` +
      `${upiBlock}\n\n` +
      `Kindly complete the payment via UPI / Bank Transfer. Thank you for your prompt cooperation!`
    );
  }, [due, customer, businessName, tone, dueDateStr, upiIntentUri, upiId]);

  if (!isOpen || !due || !customer) return null;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(reminderMessage);
      setCopiedType('msg');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const handleCopyUpiLink = async () => {
    if (!upiIntentUri) return;
    try {
      await navigator.clipboard.writeText(upiIntentUri);
      setCopiedType('upi');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const handleSendWhatsApp = () => {
    const phone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const encoded = encodeURIComponent(reminderMessage);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // Simple clean SVG QR code visualizer based on standard QR matrix representation
  const qrDisplayUrl = upiIntentUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiIntentUri)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>WhatsApp Payment Reminder</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  UPI Ready
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customer: <span className="font-semibold text-slate-800 dark:text-slate-200">{customer.name}</span>{' '}
                ({customer.phone || 'No phone'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Due Info Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Amount Receivable
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                {formatPaise(due.amount)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block">Due Date</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 justify-end mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                {dueDateStr}
              </span>
            </div>
          </div>

          {/* Business & UPI Settings (Collapsible / Compact) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Sender &amp; Payment Configuration</span>
              </span>
              {upiId && (
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{showQR ? 'Hide QR' : 'Show UPI QR'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Business / Sender Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => handleSaveMerchantConfig(e.target.value, upiId)}
                  placeholder="Your Business Name"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Merchant UPI ID (GPay / PhonePe)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => handleSaveMerchantConfig(businessName, e.target.value)}
                  placeholder="e.g. name@okhdfcbank"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* UPI QR Code Preview */}
            {showQR && qrDisplayUrl && (
              <div className="mt-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center animate-in zoom-in-95 duration-150">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                  Scan to Pay ₹{amountRupees} via Any UPI App
                </span>
                <img
                  src={qrDisplayUrl}
                  alt="UPI QR Code"
                  className="w-40 h-40 rounded-xl shadow-md border border-slate-100 dark:border-white/10"
                />
                <span className="text-[10px] font-mono text-slate-400 mt-2">
                  {upiId}
                </span>
              </div>
            )}
          </div>

          {/* Tone Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Select Message Tone
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTone('gentle')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  tone === 'gentle'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                🌸 Polite &amp; Gentle
              </button>

              <button
                type="button"
                onClick={() => setTone('standard')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  tone === 'standard'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                ⚖️ Standard
              </button>

              <button
                type="button"
                onClick={() => setTone('urgent')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  tone === 'urgent'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                🚨 Urgent Notice
              </button>
            </div>
          </div>

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                WhatsApp Preview
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                {copiedType === 'msg' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {reminderMessage}
            </div>
          </div>

          {/* UPI Direct Link Helper */}
          {upiIntentUri && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px]">
              <span className="font-mono text-slate-500 truncate max-w-[280px]">
                {upiIntentUri}
              </span>
              <button
                type="button"
                onClick={handleCopyUpiLink}
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2 flex items-center gap-1"
              >
                {copiedType === 'upi' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedType === 'upi' ? 'Copied' : 'Copy UPI Link'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open in WhatsApp</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </button>
        </div>
      </div>
    </div>
  );
}
