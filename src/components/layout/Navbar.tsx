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
  Users,
  LogIn,
  LogOut,
  User as UserIcon,
  CloudOff,
  Crown,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

interface NavbarProps {
  onOpenAskAI: () => void;
  onRefresh: () => void;
  onOpenBackupRestore?: () => void;
}

export function Navbar({ onOpenAskAI, onRefresh, onOpenBackupRestore }: NavbarProps) {
  const {
    user,
    userRole,
    theme,
    setTheme,
    syncStatus,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    pendingSyncCount,
    lastSyncTime,
    lastSyncError,
    setAuthModalOpen,
    setMembersModalOpen,
    signOut,
  } = useSessionStore();

  const [showWsMenu, setShowWsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isLight = theme === 'light';

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const isOwner = userRole === 'owner' || (user && activeWs?.owner_id === user.id);
  const isAdmin = isOwner || userRole === 'admin';

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between glass-panel shadow-sm ${
        isLight
          ? 'bg-white/95 border-slate-200/90 text-slate-800'
          : 'bg-[#0f172a]/95 border-white/10 shadow-lg shadow-black/30 text-white'
      }`}
      style={{
        paddingTop: 'max(0.55rem, env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Brand & Workspace Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-teal-400 flex items-center justify-center font-extrabold text-xs text-white shadow-md shadow-indigo-500/25 shrink-0">
            RB
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 dark:from-indigo-400 dark:via-violet-300 dark:to-teal-300 bg-clip-text text-transparent">
              Record Book
            </span>
          </div>
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline select-none">/</span>

        {/* Workspace Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setShowWsMenu(!showWsMenu);
              setShowUserMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all touch-press ${
              isLight
                ? 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="max-w-[90px] sm:max-w-[150px] truncate">
              {activeWs?.name || 'Record Book'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showWsMenu && (
            <div
              className={`absolute left-0 mt-2 w-64 rounded-2xl border shadow-2xl p-1.5 z-50 glass-panel animate-fade-in ${
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

              {user && (
                <div className="pt-1 mt-1 border-t border-inherit">
                  <button
                    onClick={() => {
                      setShowWsMenu(false);
                      setMembersModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Workspace Members</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: User Profile / Auth, Ask AI, Sync Badge, Theme */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* RADIANT MULTICOLOR ASK AI BUTTON */}
        <button
          onClick={onOpenAskAI}
          title="Open Ask AI Accountant"
          className="group flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 hover:from-violet-500 hover:to-teal-400 text-white font-bold text-xs shadow-md shadow-indigo-500/30 transition-all hover-lift touch-press cursor-pointer"
        >
          <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-300 group-hover:rotate-12 transition-transform shrink-0" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Sync Status Badge */}
        {!user ? (
          <button
            onClick={() => setAuthModalOpen(true)}
            title="Local-only mode active. Tap to sign in and enable cloud sync."
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all touch-press bg-slate-200/60 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
          >
            <CloudOff className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Local-only</span>
          </button>
        ) : (
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
        )}

        {/* User Account / Sign In Pill */}
        {!user ? (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all touch-press"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Sign In</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowWsMenu(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all touch-press ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span
                className={`hidden md:inline text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                  isOwner
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : isAdmin
                    ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    : userRole === 'member'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                }`}
              >
                {userRole || (isOwner ? 'owner' : 'viewer')}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {showUserMenu && (
              <div
                className={`absolute right-0 mt-2 w-60 rounded-2xl border shadow-2xl p-2 z-50 glass-panel animate-fade-in ${
                  isLight ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-slate-900/95 border-white/10 text-white'
                }`}
              >
                <div className="px-3 py-2 border-b border-inherit">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</div>
                  <div className="text-xs font-bold truncate mt-0.5">{user.email}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isOwner
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : isAdmin
                          ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          : userRole === 'member'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Role: {userRole || (isOwner ? 'owner' : 'viewer')}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setMembersModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Workspace Members</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
