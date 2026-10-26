'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

interface NavbarProps {
  onOpenAskAI: () => void;
  onRefresh: () => void;
}

export function Navbar({ onOpenAskAI, onRefresh }: NavbarProps) {
  const { theme, setTheme, syncStatus, workspaces, activeWorkspaceId, setActiveWorkspaceId } = useSessionStore();
  const [showWsMenu, setShowWsMenu] = useState(false);
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors px-4 sm:px-6 py-2.5 flex items-center justify-between ${
        isLight
          ? 'bg-white/95 border-zinc-200 backdrop-blur-md text-zinc-900'
          : 'bg-[#0c0d0e]/95 border-zinc-800/80 backdrop-blur-md text-zinc-100'
      }`}
    >
      {/* Brand & Workspace */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-mono font-bold text-xs tracking-wider shrink-0 shadow-2xs">
            RB
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            Record Book
          </span>
        </div>

        <span className="text-zinc-300 dark:text-zinc-700 font-light select-none">/</span>

        {/* Minimalist Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowWsMenu(!showWsMenu)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
                : 'hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="max-w-[130px] sm:max-w-[180px] truncate">
              {activeWs?.name || 'Primary Record Book'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </button>

          {showWsMenu && (
            <div
              className={`absolute left-0 mt-1.5 w-56 rounded-lg border shadow-lg p-1 z-50 ${
                isLight ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-[#141517] border-zinc-800 text-zinc-200'
              }`}
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setShowWsMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                    ws.id === activeWorkspaceId
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Ask AI, Sync Badge, Theme */}
      <div className="flex items-center gap-2">
        {/* ASK AI Linear-Style Command Button */}
        <button
          onClick={onOpenAskAI}
          title="Open Ask AI Accountant"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
            isLight
              ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          <span>Ask AI</span>
          <kbd className="hidden sm:inline-block ml-1 px-1 py-0.2 rounded border text-[10px] font-mono border-zinc-300 dark:border-zinc-700 text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* Sync Status Badge */}
        <button
          onClick={onRefresh}
          title={`Status: ${syncStatus}. Click to refresh.`}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
            isLight
              ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-500'
              : 'border-zinc-800 hover:bg-zinc-850 text-zinc-400'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className={`p-1.5 rounded-md border transition-colors ${
            isLight
              ? 'bg-transparent hover:bg-zinc-100 border-zinc-200 text-zinc-600'
              : 'bg-transparent hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
          title="Toggle Theme"
        >
          {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
