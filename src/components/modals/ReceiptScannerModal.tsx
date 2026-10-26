'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Store,
  Calendar,
  CreditCard,
  Wallet,
  Tag,
} from 'lucide-react';
import { parseReceiptImage, ParsedReceipt } from '@/lib/receiptParser';
import { syncEngine } from '@/lib/syncEngine';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { parseToPaise, formatPaise } from '@/lib/money';
import { LedgerEntry } from '@/types';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptScannerModal({ isOpen, onClose }: ReceiptScannerModalProps) {
  const { activeWorkspaceId, theme } = useSessionStore();
  const { accounts } = useAccountStore();
  const { cards } = useCardStore();
  const isLight = theme === 'light';

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ParsedReceipt | null>(null);

  // Form edit states
  const [merchant, setMerchant] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card' | 'bank'>('card');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);
    setScannedResult(null);

    try {
      const result = await parseReceiptImage(file);
      setScannedResult(result);
      setMerchant(result.merchant);
      setAmountRupees(result.amountRupees.toString());
      setCategory(result.category);
      setPaymentMode(result.paymentMode);

      if (result.paymentMode === 'card' && cards.length > 0) {
        setSelectedCardId(cards[0].id);
      } else if (accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveToLedger = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(amountRupees);
    if (paise <= 0 || !merchant.trim()) return;

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: paymentMode === 'card' ? 'card_spend' : 'cash_out',
      amount: paise,
      card_id: paymentMode === 'card' ? selectedCardId || undefined : undefined,
      cash_location_id: paymentMode !== 'card' ? selectedAccountId || undefined : undefined,
      mode: paymentMode,
      note: `Receipt: ${merchant.trim()} (${category})`,
      entry_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    syncEngine.pushLedgerEntry(newEntry);

    // Update bank balance if cash/upi/bank
    if (paymentMode !== 'card' && selectedAccountId) {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      if (acc) {
        syncEngine.updateAccountBalance(selectedAccountId, Math.max(0, acc.balance - paise));
      }
    }

    // Reset & close
    setImagePreview(null);
    setScannedResult(null);
    onClose();
  };

  const handleReset = () => {
    setImagePreview(null);
    setScannedResult(null);
    setMerchant('');
    setAmountRupees('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-white">
                <span>AI Receipt & Bill Scanner</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                  OCR Engine
                </span>
              </h3>
              <p className="text-[11px] text-white/80">
                Snap or upload invoice photos for auto-extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {!imagePreview ? (
            /* Upload Drop Area */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer transition-all hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 group"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Take Photo or Upload Receipt
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Supports grocery bills, restaurant receipts, petrol slips, and electricity invoices.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20">
                <Camera className="w-4 h-4" />
                <span>Open Camera / Gallery</span>
              </div>
            </div>
          ) : (
            /* Image Preview & Scanning Status */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 max-h-48 bg-slate-950 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Receipt Preview"
                  className="w-full h-48 object-cover opacity-80"
                />

                {/* Laser Scanning Line Animation */}
                {isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-pulse" />
                    <div className="mt-3 px-3 py-1.5 rounded-full bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning text & amounts...</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Parsed Results Form */}
              {scannedResult && (
                <form onSubmit={handleSaveToLedger} className="space-y-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Receipt Scanned Successfully! Review and tap Confirm.</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Merchant */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Merchant / Vendor
                      </label>
                      <div className="relative">
                        <Store className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={merchant}
                          onChange={(e) => setMerchant(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Total Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="text-slate-400 font-bold absolute left-3 top-2 text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={amountRupees}
                          onChange={(e) => setAmountRupees(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Category */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Groceries">Groceries</option>
                        <option value="Fuel & Travel">Fuel & Travel</option>
                        <option value="Dining & Food">Dining & Food</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Bills & Utilities">Bills & Utilities</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="General">General</option>
                      </select>
                    </div>

                    {/* Payment Mode */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Paid Via
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="card">Credit / Debit Card</option>
                        <option value="upi">UPI / GPay / PhonePe</option>
                        <option value="cash">Physical Cash</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  {/* Destination Account / Card Selector */}
                  {paymentMode === 'card' && cards.length > 0 && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Select Card
                      </label>
                      <select
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (•••• {c.last4})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {paymentMode !== 'card' && accounts.length > 0 && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Deduct From Account
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatPaise(a.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover-lift touch-press mt-2"
                  >
                    <span>Save to Ledger & Cloud</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
