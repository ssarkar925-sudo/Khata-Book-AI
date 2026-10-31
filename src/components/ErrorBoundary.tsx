'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Wrench } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Reset session and go to dashboard
    useSessionStore.getState().resetSession();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#090d16]">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We caught an unexpected error. Your data is safe, but this screen couldn't load properly.
              </p>
            </div>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="text-left p-4 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2">
                <summary className="font-mono text-xs text-slate-500 cursor-pointer">
                  Error Details (Development)
                </summary>
                <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition-all hover-lift touch-press flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                <span>Full Reload</span>
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to access error boundary state
export function useErrorHandler() {
  // This would need a context provider for full functionality
  // For now, components can throw errors which will be caught by ErrorBoundary
  return {
    captureError: (error: Error) => {
      throw error;
    },
  };
}
