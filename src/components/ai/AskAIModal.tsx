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
      text: 'Hello! I am **Ask AI**, your personal financial accountant. Ask me about your monthly spending, who owes you money, upcoming card bills, or total balances.',
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
    { label: 'Spend This Month', icon: TrendingDown, query: 'How much did I spend this month?' },
    { label: 'Who Owes Me?', icon: Users, query: 'Who owes me money?' },
    { label: 'Card Bills', icon: CreditCard, query: 'What are my credit card bills?' },
    { label: 'Total Balances', icon: Wallet, query: 'What is my total cash and bank balance?' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Ask AI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Accountant
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Instant financial intelligence on your Khata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white font-medium rounded-tr-xs'
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors"
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
            <div className="flex items-center gap-2 text-xs text-slate-400 pl-9 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Analyzing your khata records...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 overflow-x-auto scrollbar-none bg-slate-50/50 dark:bg-slate-950/20">
          {quickQuestions.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(chip.query)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 whitespace-nowrap transition-all touch-press"
              >
                <Icon className="w-3 h-3 text-emerald-500" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything (e.g. who owes me money?)..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition-all shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
