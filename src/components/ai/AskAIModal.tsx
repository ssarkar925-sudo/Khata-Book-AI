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
      text: 'Hello. I am **Ask AI**, your automated financial assistant. You can ask me about monthly spending, debtor dues, upcoming credit card cutoffs, or net liquid balances.',
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
    }, 200);
  };

  const quickQuestions = [
    { label: 'Spend This Month', icon: TrendingDown, query: 'How much did I spend this month?' },
    { label: 'Who Owes Me?', icon: Users, query: 'Who owes me money?' },
    { label: 'Card Bills', icon: CreditCard, query: 'What are my credit card bills?' },
    { label: 'Total Balances', icon: Wallet, query: 'What is my total cash and bank balance?' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-[580px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-mono text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Ask AI Assistant</span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                    : 'bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap'
                }`}
              >
                {msg.text}

                {msg.action && msg.action.type === 'whatsapp' && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-750">
                    <a
                      href={`https://wa.me/91${msg.action.payload.phone}?text=Hello%20${encodeURIComponent(
                        msg.action.payload.name
                      )},%20this%20is%20a%20reminder%20regarding%20pending%20balance%20of%20Rs.%20${(
                        msg.action.payload.amount / 100
                      ).toFixed(2)}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-[11px] transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{msg.action.label}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 pl-8 font-mono animate-pulse">
              <span>computing financial data...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestions Chips */}
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-850 overflow-x-auto flex gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q.query)}
              className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
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
              placeholder="Ask anything about your finances..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
