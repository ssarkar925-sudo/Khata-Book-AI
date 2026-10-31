'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ScreenWrapperProps {
  children: React.ReactNode;
  screenName: string;
}

export function ScreenWrapper({ children, screenName }: ScreenWrapperProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error(`[ScreenWrapper:${screenName}] Error caught:`, error, errorInfo);
        // Could send to error reporting service here
      }}
    >
      <div data-screen={screenName}>
        {children}
      </div>
    </ErrorBoundary>
  );
}

// Higher-order component for wrapping screens
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  screenName: string
): React.FC<P> {
  return function WrappedComponent(props: P) {
    return (
      <ScreenWrapper screenName={screenName}>
        <Component {...props} />
      </ScreenWrapper>
    );
  };
}
