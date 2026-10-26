'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  MessageSquare,
  Bot,
  TrendingDown,
  Users,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { answerFinancialQuery } from '@/lib/aiAssistant';

interface AskAIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AskAIModal({ isOpen, onClose }: AskAIModalProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; action?: any }>>([
    {
      sender: 'ai',
      text: 'Hello! I am **Ask AI**, your automated financial accountant. You can ask me about your monthly spending, who owes you money, upcoming card bills, or total balances.',
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const { entries: ledger } = useLedgerStore();
  const { customers, dues } = useCustomerStore();
  const { cards } = useCardStore();

  if (!isOpen) return null;

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || query).trim();
    if (!q) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setQuery('');
    setIsThinking(true);

    setTimeout(() => {
      const res = answerFinancialQuery(q, {
        ledger,
        dues,
        customers,
        cards,
        cashLocations: [],
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          action: res.actionSuggestion,
        },
      ]);
      setIsThinking(false);
    }, 250);
  };

  const quickQuestions = [
    { label: 'Spend This Month', icon: TrendingDown, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', query: 'How much did I spend this month?' },
    { label: 'Who Owes Me?', icon: Users, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20', query: 'Who owes me money?' },
    { label: 'Card Bills', icon: CreditCard, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', query: 'What are my credit card bills?' },
    { label: 'Total Balances', icon: Wallet, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', query: 'What is my total cash and bank balance?' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden">
        {/* Colorful Gradient Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-white">
                <span>Ask AI Accountant</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                  Intelligence
                </span>
              </h3>
              <p className="text-[11px] text-white/80">
                Natural-language financial advice and instant query engine
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

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-500/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium rounded-tr-xs shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-xs whitespace-pre-wrap'
                }`}
              >
                {msg.text}

                {msg.action && msg.action.type === 'whatsapp' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                    <a
                      href={`https://wa.me/91${msg.action.payload.phone}?text=Hello%20${encodeURIComponent(
                        msg.action.payload.name
                      )},%20this%20is%20a%20reminder%20regarding%20pending%20balance%20of%20Rs.%20${(
                        msg.action.payload.amount / 100
                      ).toFixed(2)}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-[11px] shadow-md shadow-emerald-500/25"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{msg.action.label}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-indigo-500 pl-9 font-semibold animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyzing financial records...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5 overflow-x-auto flex gap-2">
          {quickQuestions.map((q, idx) => {
            const Icon = q.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(q.query)}
                className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all hover-lift touch-press ${q.color}`}
              >
                <Icon className="w-3 h-3" />
                <span>{q.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              autoFocus
              placeholder="Ask anything about your money, dues, or bank accounts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-500/25"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
