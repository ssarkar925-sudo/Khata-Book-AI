'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Wallet,
  Tag,
  Languages,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { parseVoiceInput, ParsedVoiceExpense } from '@/lib/voiceParser';
import { syncEngine } from '@/lib/syncEngine';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise, parseToPaise } from '@/lib/money';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { LedgerEntry } from '@/types';

interface VoiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceExpenseModal({ isOpen, onClose }: VoiceExpenseModalProps) {
  const { activeWorkspaceId, theme } = useSessionStore();
  const { accounts } = useAccountStore();
  const { cards } = useCardStore();
  const isLight = theme === 'light';

  const [language, setLanguage] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceExpense | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Editable parsed fields
  const [editType, setEditType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [editAmountRupees, setEditAmountRupees] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('food');
  const [editMode, setEditMode] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Speech Recognition reference
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = false;
        reco.interimResults = true;
        reco.lang = language;

        reco.onresult = (event: any) => {
          let currentText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          if (event.results[0].isFinal) {
            handleProcessVoice(currentText);
            setIsListening(false);
          }
        };

        reco.onerror = (event: any) => {
          console.warn('[VoiceExpense] Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone access denied. Please grant permission in browser settings.');
          } else {
            setErrorMsg('Could not detect speech. Please try speaking again.');
          }
        };

        reco.onend = () => {
          setIsListening(false);
        };

        setRecognition(reco);
      } else {
        setErrorMsg('Web Speech API is not supported in this browser. Try Chrome or Android.');
      }
    }
  }, [language]);

  const handleProcessVoice = (text: string) => {
    const res = parseVoiceInput(text);
    setParsed(res);
    setEditType(res.type === 'cash_in' ? 'cash_in' : 'cash_out');
    setEditAmountRupees(res.amountRupees > 0 ? res.amountRupees.toString() : '');
    setEditCategory(res.category);
    setEditMode(res.mode);
    setEditNote(res.note);

    // Auto-link account if matched
    if (res.accountName && accounts.length > 0) {
      const matched = accounts.find((a) =>
        a.name.toLowerCase().includes(res.accountName!.toLowerCase())
      );
      if (matched) setEditAccountId(matched.id);
      else setEditAccountId(accounts[0].id);
    } else if (accounts.length > 0) {
      setEditAccountId(accounts[0].id);
    }
  };

  if (!isOpen) return null;

  const startListening = () => {
    setErrorMsg('');
    setTranscript('');
    setParsed(null);
    if (recognition) {
      try {
        recognition.lang = language;
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    } else {
      simulateVoiceDemo();
    }
  };

  const stopListening = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const simulateVoiceDemo = (sampleText?: string) => {
    const sample = sampleText || '500 rupay petrol mein kharch kiya HDFC se';
    setIsListening(true);
    setTranscript('Listening to voice...');
    setTimeout(() => {
      setTranscript(sample);
      handleProcessVoice(sample);
      setIsListening(false);
    }, 1000);
  };

  const handleSaveToLedger = () => {
    const parsedAmountPaise = parseToPaise(editAmountRupees);
    if (parsedAmountPaise <= 0) return;

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId || '00000000-0000-0000-0000-000000000010',
      type: editType,
      amount: parsedAmountPaise,
      mode: editMode,
      category_id: editCategory,
      cash_location_id: editAccountId || (accounts.length > 0 ? accounts[0].id : undefined),
      card_id: editMode === 'card' && cards.length > 0 ? cards[0].id : undefined,
      note: editNote.trim() || (editType === 'cash_in' ? 'Voice Income' : 'Voice Expense'),
      entry_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    syncEngine.pushLedgerEntry(newEntry);

    setTranscript('');
    setParsed(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-white">
                <span>AI Voice Accounting</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                  Hinglish & English
                </span>
              </h3>
              <p className="text-[11px] text-white/80">
                Speak naturally in Hindi, Hinglish or English
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

        {/* Language Selector */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10 text-xs">
          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
            <Languages className="w-3.5 h-3.5" /> Language:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLanguage('hi-IN')}
              className={`px-3 py-1 rounded-xl font-bold transition-all ${
                language === 'hi-IN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              🇮🇳 Hindi / Hinglish
            </button>
            <button
              onClick={() => setLanguage('en-IN')}
              className={`px-3 py-1 rounded-xl font-bold transition-all ${
                language === 'en-IN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              🇬🇧 English (India)
            </button>
          </div>
        </div>

        {/* Voice Interaction Body */}
        <div className="p-6 overflow-y-auto flex flex-col items-center text-center space-y-4">
          {/* Animated Microphone Button */}
          <div className="relative my-2">
            {isListening && (
              <>
                <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="absolute -inset-8 rounded-full bg-indigo-500/10 animate-pulse" />
              </>
            )}
            <button
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-22 h-22 rounded-full flex items-center justify-center text-white shadow-2xl transition-all touch-press ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/40 scale-105'
                  : 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-teal-500 shadow-indigo-500/35 hover:scale-105'
              }`}
            >
              {isListening ? (
                <MicOff className="w-9 h-9 animate-bounce" />
              ) : (
                <Mic className="w-9 h-9" />
              )}
            </button>
          </div>

          <div>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
              {isListening ? 'Listening...' : 'Tap Mic & Speak'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              {isListening
                ? 'Speak in Hindi or English (e.g. "500 rupay petrol mein kharch kiya")'
                : 'Supports speech with automatic category, payment mode & bank account matching.'}
            </p>
          </div>

          {/* Quick Demo Voice Chips */}
          {!isListening && !parsed && (
            <div className="w-full text-left space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tap to Try Sample Voice Inputs:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '500 rupay petrol mein kharch kiya HDFC se',
                  'Ramesh ne 2000 rupay diye cash mein',
                  'Chai nashta 150 rupay cash',
                  'Bijli ka bill 1200 pay kiya',
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => simulateVoiceDemo(sample)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    &ldquo;{sample}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="w-full p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Live Recognized Speech */}
          {transcript && (
            <div className="w-full p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Recognized:
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 italic">
                &ldquo;{transcript}&rdquo;
              </p>
            </div>
          )}

          {/* AI Extracted & Editable Form */}
          {parsed && (
            <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 text-left space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Extracted Details</span>
                </span>

                {/* Direction Switcher */}
                <div className="flex rounded-xl bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setEditType('cash_in')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      editType === 'cash_in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    + Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('cash_out')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      editType === 'cash_out'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    − Expense
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-base font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={editAmountRupees}
                    onChange={(e) => setEditAmountRupees(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-lg font-black text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Category & Payment Mode */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>

              {/* Linked Bank / Cash Account */}
              {accounts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Linked Bank / Cash Account
                  </label>
                  <select
                    value={editAccountId}
                    onChange={(e) => setEditAccountId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatPaise(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remark / Note
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Note..."
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleSaveToLedger}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover-lift touch-press"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Record to Ledger</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
