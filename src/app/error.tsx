'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    console.error('Unhandled app error:', error);
    if (error?.message) {
      setErrorMessage(error.message);
    }
  }, [error]);

  const handleResetData = () => {
    try {
      localStorage.removeItem('rb_saved_sheets');
      localStorage.removeItem('rb_sync_queue');
      localStorage.removeItem('rb_ledger_entries');
      localStorage.removeItem('rb_customers');
      localStorage.removeItem('rb_dues');
      localStorage.removeItem('rb_notes');
    } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-4">
        An unexpected error occurred while loading this view. Tap below to reload and continue.
      </p>

      {errorMessage && (
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 text-left">
          <p className="text-[11px] font-mono text-rose-400 break-words line-clamp-3">
            {errorMessage}
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors"
        >
          Reload App
        </button>
        <button
          onClick={handleResetData}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs border border-rose-500/20 transition-colors"
          title="Clears corrupted local cache and re-fetches from cloud"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clean Cache & Reset
        </button>
      </div>
    </div>
  );
}
