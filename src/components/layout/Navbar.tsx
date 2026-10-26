'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Building,
  CheckCircle2,
  Plus,
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
      className={`sticky top-0 z-40 w-full border-b transition-all px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between ${
        isLight
          ? 'bg-white/85 border-slate-200/90 backdrop-blur-xl shadow-xs text-slate-800'
          : 'bg-slate-950/85 border-white/10 backdrop-blur-xl text-white shadow-lg shadow-black/20'
      }`}
    >
      {/* Brand & Workspace Switcher */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-teal-400 flex items-center justify-center font-extrabold text-sm text-white shadow-md shadow-emerald-500/25 shrink-0">
          RB
        </div>
        <div className="hidden sm:block">
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
            Record Book
          </span>
        </div>

        {/* Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowWsMenu(!showWsMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all touch-press ${
              isLight
                ? 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-200 text-slate-800 shadow-xs'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 shadow-xs'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="max-w-[120px] sm:max-w-[180px] truncate">
              {activeWs?.name || 'Primary Record Book'}
            </span>
          </button>

          {showWsMenu && (
            <div
              className={`absolute left-0 mt-2 w-60 rounded-2xl border shadow-2xl p-2 z-50 ${
                isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-white/10 text-white'
              }`}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setShowWsMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                    ws.id === activeWorkspaceId
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold'
                      : isLight
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspaceId && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Ask AI, Sync Badge, Theme */}
      <div className="flex items-center gap-2">
        {/* ASK AI BUTTON (Prominent, High-Value) */}
        <button
          onClick={onOpenAskAI}
          title="Open Ask AI Accountant"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all touch-press"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask AI</span>
        </button>

        {/* Sync Status Badge */}
        <button
          onClick={onRefresh}
          title={`Sync status: ${syncStatus}. Tap to refresh.`}
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all touch-press ${
            syncStatus === 'synced'
              ? isLight
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-500'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              syncStatus === 'synced' ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500'
            }`} />
          </span>
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className={`p-2 rounded-xl border transition-all touch-press ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-amber-400'
          }`}
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
