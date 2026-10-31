'use client';

import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { Card, LedgerEntry } from '@/types';
import { parseToPaise, formatPaise } from '@/lib/money';
import { syncEngine } from '@/lib/syncEngine';
import { useSessionStore } from '@/stores/useSessionStore';

interface CardStatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  initialCardId?: string;
}

interface ParsedStatementRow {
  date: string;
  merchant: string;
  amount: number; // in paise
  isPayment: boolean;
  isBilled: boolean;
}

export function CardStatementImportModal({
  isOpen,
  onClose,
  cards,
  initialCardId,
}: CardStatementImportModalProps) {
  const { user, activeWorkspaceId } = useSessionStore();
  const [selectedCardId, setSelectedCardId] = useState(initialCardId || (cards[0]?.id || ''));
  const [statementText, setStatementText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [defaultBilled, setDefaultBilled] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  // Parse CSV or tab-separated text
  const handleParseText = () => {
    if (!statementText.trim()) return;
    const lines = statementText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: ParsedStatementRow[] = [];

    for (const line of lines) {
      // Split by tab, comma, or multiple spaces
      const parts = line.split(/[,\t]+/).map((p) => p.trim());
      if (parts.length < 2) continue;

      const dateStr = parts[0];
      const desc = parts[1] || 'Card Transaction';
      const amountStr = parts[2] || parts[parts.length - 1];

      // Extract amount digits
      const cleanedAmount = amountStr.replace(/[^0-9.-]/g, '');
      const parsedPaise = parseToPaise(cleanedAmount);
      if (parsedPaise <= 0) continue;

      const isPayment =
        desc.toLowerCase().includes('payment') ||
        desc.toLowerCase().includes('cr') ||
        desc.toLowerCase().includes('credit') ||
        desc.toLowerCase().includes('reversal') ||
        desc.toLowerCase().includes('refund');

      // Normalize date if possible (DD/MM/YYYY to YYYY-MM-DD)
      let finalDate = new Date().toISOString();
      const dParts = dateStr.split(/[-/]/);
      if (dParts.length === 3) {
        if (dParts[0].length === 4) {
          finalDate = new Date(`${dParts[0]}-${dParts[1]}-${dParts[2]}T12:00:00Z`).toISOString();
        } else if (dParts[2].length === 4) {
          finalDate = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T12:00:00Z`).toISOString();
        }
      }

      results.push({
        date: finalDate,
        merchant: desc,
        amount: parsedPaise,
        isPayment,
        isBilled: defaultBilled,
      });
    }

    setParsedRows(results);
  };

  const handleExecuteImport = async () => {
    if (!selectedCardId || parsedRows.length === 0) return;
    setIsImporting(true);

    try {
      let count = 0;
      for (const row of parsedRows) {
        const entry: LedgerEntry = {
          id: crypto.randomUUID(),
          workspace_id: activeWorkspaceId,
          type: row.isPayment ? 'bill_payment' : 'card_spend',
          amount: row.amount,
          card_id: selectedCardId,
          mode: 'card',
          is_billed: row.isPayment ? undefined : row.isBilled,
          note: `${row.isPayment ? 'Statement Bill Payment' : 'Imported Swipe'}: ${row.merchant}`,
          entry_date: row.date,
          created_by: user?.id || 'owner',
        };
        await syncEngine.pushLedgerEntry(entry);
        count++;
      }

      setSuccessCount(count);
      setParsedRows([]);
      setStatementText('');
    } catch (err) {
      console.error('Import failed', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Import Card Statement / CSV
              </h3>
              <p className="text-xs text-slate-400">
                Bulk ingest monthly card statement debits & payments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Selector & Billing Target */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Destination Credit Card
            </label>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} •••• {c.last4} ({c.bank})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Billing Classification
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDefaultBilled(true)}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  defaultBilled
                    ? 'bg-rose-600 text-white border-transparent'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                🔴 Billed Statement
              </button>
              <button
                type="button"
                onClick={() => setDefaultBilled(false)}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  !defaultBilled
                    ? 'bg-purple-600 text-white border-transparent'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                🟣 Unbilled Spends
              </button>
            </div>
          </div>
        </div>

        {/* Input Text Area or Parsed Grid */}
        {parsedRows.length === 0 ? (
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Paste Statement Rows (Date, Merchant Description, Amount)
            </label>
            <textarea
              rows={6}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Example format:&#10;28/10/2026, Amazon India, 1499.00&#10;26/10/2026, Swiggy Food, 640.50&#10;24/10/2026, Payment Received Auto-Debit, 25000.00"
              className="w-full flex-1 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-slate-400">
                Supports CSV lines, tab-separated Excel copy-paste.
              </span>
              <button
                type="button"
                onClick={handleParseText}
                disabled={!statementText.trim()}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all"
              >
                Parse & Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Parsed {parsedRows.length} transactions ready to import
              </span>
              <button
                type="button"
                onClick={() => setParsedRows([])}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white underline font-semibold"
              >
                Clear / Re-paste
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-2xl p-2 divide-y divide-slate-100 dark:divide-white/5 text-xs">
              {parsedRows.map((row, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold text-slate-900 dark:text-white block truncate">
                      {row.merchant}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} •{' '}
                      {row.isPayment ? '🟢 Payment' : row.isBilled ? '🔴 Billed' : '🟣 Unbilled'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-black tabular-nums ${row.isPayment ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                      {row.isPayment ? '-' : ''}{formatPaise(row.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setParsedRows([])}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-purple-600/25 flex items-center justify-center gap-1.5"
              >
                {isImporting ? 'Importing...' : `Import ${parsedRows.length} Items`}
              </button>
            </div>
          </div>
        )}

        {successCount !== null && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between">
            <span>🎉 Successfully imported {successCount} transactions into card ledger!</span>
            <button
              onClick={() => {
                setSuccessCount(null);
                onClose();
              }}
              className="underline"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
