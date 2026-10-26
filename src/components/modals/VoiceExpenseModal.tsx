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
} from 'lucide-react';
import { parseVoiceInput, ParsedVoiceExpense } from '@/lib/voiceParser';
import { syncEngine } from '@/lib/syncEngine';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { formatPaise } from '@/lib/money';
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

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceExpense | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

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
        reco.lang = 'en-IN'; // Indian English accent recognition

        reco.onresult = (event: any) => {
          let currentText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          if (event.results[0].isFinal) {
            const result = parseVoiceInput(currentText);
            setParsed(result);
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
  }, []);

  if (!isOpen) return null;

  const startListening = () => {
    setErrorMsg('');
    setTranscript('');
    setParsed(null);
    if (recognition) {
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    } else {
      // Demo fallback if browser lacks microphone or speech engine
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
    const sample = sampleText || 'Paid 450 rupees for lunch at Mainland China by card';
    setIsListening(true);
    setTranscript('Listening to voice...');
    setTimeout(() => {
      setTranscript(sample);
      setParsed(parseVoiceInput(sample));
      setIsListening(false);
    }, 1200);
  };

  const handleSaveToLedger = () => {
    if (!parsed || parsed.amountPaise <= 0) return;

    const newEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: parsed.type,
      amount: parsed.amountPaise,
      mode: parsed.mode,
      card_id: parsed.mode === 'card' && cards.length > 0 ? cards[0].id : undefined,
      cash_location_id: parsed.mode !== 'card' && accounts.length > 0 ? accounts[0].id : undefined,
      note: parsed.note,
      entry_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    syncEngine.pushLedgerEntry(newEntry);

    // Update bank balance if cash or bank
    if (parsed.mode !== 'card' && accounts.length > 0) {
      const defaultAcc = accounts[0];
      const newBal =
        parsed.type === 'cash_in'
          ? defaultAcc.balance + parsed.amountPaise
          : Math.max(0, defaultAcc.balance - parsed.amountPaise);
      syncEngine.updateAccountBalance(defaultAcc.id, newBal);
    }

    setTranscript('');
    setParsed(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-white">
                <span>Voice Expense Dictation</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                  AI Speech
                </span>
              </h3>
              <p className="text-[11px] text-white/80">
                Speak naturally to record expenses or income
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

        {/* Voice Interaction Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-5">
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
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all touch-press ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/40 scale-105'
                  : 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-teal-500 shadow-indigo-500/35 hover:scale-105'
              }`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 animate-bounce" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
          </div>

          <div>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
              {isListening ? 'Listening to your voice...' : 'Tap the microphone & speak'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              {isListening
                ? 'Speak amount, purpose, and mode (e.g., "Paid 650 cash for petrol at Shell")'
                : 'Supports English, Hindi, and Bengali speech formats.'}
            </p>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="w-full p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Spoken Transcript Preview */}
          {transcript && (
            <div className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Recognized Speech:
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 italic">
                &ldquo;{transcript}&rdquo;
              </p>
            </div>
          )}

          {/* AI Parsed Expense Card */}
          {parsed && (
            <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 text-left space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AI Extracted Record</span>
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    parsed.type === 'cash_in'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  {parsed.type === 'cash_in' ? 'Income / Inflow' : 'Expense / Outflow'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {parsed.type === 'cash_in' ? '+' : '-'}₹{parsed.amountRupees.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize flex items-center gap-1">
                  <span>via</span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/10 uppercase text-[10px] font-extrabold">
                    {parsed.mode}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{parsed.note}</span>
                <span className="text-[10px] text-slate-400">({parsed.category})</span>
              </div>

              <button
                onClick={handleSaveToLedger}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all hover-lift touch-press"
              >
                <span>Confirm & Save to Record Book</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Voice Demo Presets */}
          {!parsed && !isListening && (
            <div className="w-full space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Or try one-tap sample voice notes:
              </span>
              <div className="flex flex-wrap gap-1.5 justify-center">
                <button
                  onClick={() => simulateVoiceDemo('Paid 450 rupees for lunch at Mainland China by card')}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors"
                >
                  &ldquo;Paid 450 lunch card&rdquo;
                </button>
                <button
                  onClick={() => simulateVoiceDemo('Spent 1200 rupees on petrol cash at Indian Oil')}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors"
                >
                  &ldquo;Spent 1200 petrol cash&rdquo;
                </button>
                <button
                  onClick={() => simulateVoiceDemo('Received 15000 consulting fee by UPI')}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors"
                >
                  &ldquo;Received 15000 UPI&rdquo;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
