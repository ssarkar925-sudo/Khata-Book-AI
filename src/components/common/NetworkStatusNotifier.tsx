'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';

export function NetworkStatusNotifier() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const { activeWorkspaceId } = useSessionStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredNotice(true);

      // Trigger instant background sync
      const wsId = activeWorkspaceId || useSessionStore.getState().activeWorkspaceId;
      if (wsId) {
        syncEngine.flushQueue().then(() => {
          syncEngine.pullAll(wsId);
        });
      }

      // Hide restored banner after 3.5 seconds
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 3500);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeWorkspaceId]);

  if (isOnline && !showRestoredNotice) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9999] pointer-events-none flex justify-center px-4 pt-2 pb-1"
    >
      {!isOnline ? (
        <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 bg-rose-600/95 dark:bg-rose-950/90 border border-rose-500/40 text-white rounded-full shadow-lg shadow-rose-900/30 backdrop-blur-md text-xs font-semibold animate-in slide-in-from-top-2 duration-200">
          <WifiOff className="w-3.5 h-3.5 text-rose-200 animate-pulse" />
          <span>No internet — Offline mode active. Auto-reconnecting...</span>
          <span className="w-2 h-2 rounded-full bg-rose-300 animate-ping" />
        </div>
      ) : showRestoredNotice ? (
        <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 bg-emerald-600/95 dark:bg-emerald-950/90 border border-emerald-500/40 text-white rounded-full shadow-lg shadow-emerald-900/30 backdrop-blur-md text-xs font-semibold animate-in slide-in-from-top-2 duration-200">
          <Wifi className="w-3.5 h-3.5 text-emerald-200" />
          <span>Internet restored! Synchronized successfully.</span>
        </div>
      ) : null}
    </aside>
  );
}
