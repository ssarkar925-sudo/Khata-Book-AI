'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Building,
  ChevronDown,
  Check,
  Shield,
  Database,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

interface NavbarProps {
  onOpenAskAI: () => void;
  onRefresh: () => void;
  onOpenBackupRestore?: () => void;
}

export function Navbar({ onOpenAskAI, onRefresh, onOpenBackupRestore }: NavbarProps) {
  const {
    theme,
    setTheme,
    syncStatus,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    pendingSyncCount,
    lastSyncTime,
    lastSyncError,
  } = useSessionStore();
  const [showWsMenu, setShowWsMenu] = useState(false);
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between glass-panel ${
        isLight
          ? 'bg-white/80 border-slate-200/80 shadow-xs text-slate-800'
          : 'bg-[#0f172a]/80 border-white/10 shadow-lg shadow-black/20 text-white'
      }`}
    >
      {/* Brand & Workspace Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-teal-400 flex items-center justify-center font-extrabold text-xs text-white shadow-md shadow-indigo-500/25 shrink-0">
            RB
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 dark:from-indigo-400 dark:via-violet-300 dark:to-teal-300 bg-clip-text text-transparent">
              Record Book
            </span>
          </div>
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline select-none">/</span>

        {/* Workspace Pill */}
        <div className="relative">
          <button
            onClick={() => setShowWsMenu(!showWsMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all touch-press ${
              isLight
                ? 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="max-w-[120px] sm:max-w-[170px] truncate">
              {activeWs?.name || 'Primary Record Book'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showWsMenu && (
            <div
              className={`absolute left-0 mt-2 w-56 rounded-2xl border shadow-2xl p-1.5 z-50 glass-panel ${
                isLight ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-slate-900/95 border-white/10 text-white'
              }`}
            >
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setShowWsMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    ws.id === activeWorkspaceId
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Radiant Ask AI, Sync Indicator, Theme */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* RADIANT MULTICOLOR ASK AI BUTTON */}
        <button
          onClick={onOpenAskAI}
          title="Open Ask AI Accountant"
          className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 hover:from-violet-500 hover:to-teal-400 text-white font-bold text-xs shadow-md shadow-indigo-500/30 transition-all hover-lift touch-press"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
          <span>Ask AI</span>
          <span className="hidden md:inline-block text-[10px] font-semibold bg-white/20 px-1.5 py-0.2 rounded-full">
            Accountant
          </span>
        </button>

        {/* Sync Status Badge */}
        <button
          onClick={onRefresh}
          title={
            syncStatus === 'error'
              ? `Sync Error: ${lastSyncError || 'Check connection'}. Tap to retry.`
              : syncStatus === 'offline' && pendingSyncCount > 0
              ? `${pendingSyncCount} changes queued offline. Tap to sync.`
              : `Status: ${syncStatus}. ${formattedSyncTime ? 'Last synced at ' + formattedSyncTime : ''}`
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all touch-press ${
            syncStatus === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : syncStatus === 'syncing'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : pendingSyncCount > 0
              ? 'bg-amber-500/15 border-amber-500/35 text-amber-700 dark:text-amber-300'
              : syncStatus === 'synced'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
              : 'bg-slate-200/50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
          }`}
        >
          {syncStatus === 'syncing' ? (
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
          ) : syncStatus === 'error' ? (
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
          ) : pendingSyncCount > 0 ? (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          ) : syncStatus === 'synced' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          )}

          <span className="hidden sm:inline">
            {syncStatus === 'syncing'
              ? 'Syncing...'
              : syncStatus === 'error'
              ? 'Sync Error'
              : pendingSyncCount > 0
              ? `${pendingSyncCount} Pending`
              : syncStatus === 'synced'
              ? formattedSyncTime
                ? `Synced ${formattedSyncTime}`
                : 'Cloud Synced'
              : 'Offline Mode'}
          </span>
          <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-500 hidden sm:inline" />
        </button>

        {/* Backup & App Lock Security Button */}
        {onOpenBackupRestore && (
          <button
            onClick={onOpenBackupRestore}
            className={`p-2 rounded-xl border transition-all touch-press ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
            }`}
            title="Backup, Restore & App Lock"
          >
            <Shield className="w-4 h-4 text-indigo-500" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className={`p-2 rounded-xl border transition-all touch-press ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-amber-400'
          }`}
          title="Toggle Theme"
        >
          {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </div>
    </header>
  );
}
