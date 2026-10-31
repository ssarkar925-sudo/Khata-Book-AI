'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X, Check } from 'lucide-react';

/* ============================================
   Modal Types
   ============================================ */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  loading?: boolean;
}

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export interface ToastProps {
  id: string;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: (id: string) => void;
  action?: { label: string; onClick: () => void };
}

/* ============================================
   Modal (Base)
   ============================================ */

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      description,
      children,
      size = 'md',
      showCloseButton = true,
      closeOnOverlayClick = true,
      closeOnEscape = true,
      className,
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Focus management
    useEffect(() => {
      if (isOpen) {
        previousActiveElement.current = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        // Focus first focusable element
        setTimeout(() => {
          const focusable = modalRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          focusable?.focus();
        }, 50);
      } else {
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    // Escape key handler
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'Escape' && closeOnEscape) {
          onClose();
        }
        // Trap focus
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusableElements?.length) return;
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeOnEscape]);

    if (!isOpen) return null;

    const modalContent = (
      <div
        ref={ref}
        className={clsx(
          'modal-content flex flex-col',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-md',
          size === 'lg' && 'max-w-lg',
          size === 'xl' && 'max-w-xl',
          size === 'full' && 'max-w-4xl',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-surface-200 dark:border-surface-700">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-icon-md flex-shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    );

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="modal-backdrop"
          onClick={closeOnOverlayClick ? onClose : undefined}
          aria-hidden="true"
        />
        {modalContent}
      </div>,
      document.body
    );
  }
);

Modal.displayName = 'Modal';

/* ============================================
   Confirm Modal
   ============================================ */

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) => {
  const variantStyles = {
    danger: { confirm: 'btn-danger', icon: '⚠️' },
    primary: { confirm: 'btn-primary', icon: 'ℹ️' },
    warning: { confirm: 'btn-warning', icon: '⚠️' },
  };

  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-surface-600 dark:text-surface-400">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={clsx('btn', style.confirm)}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================
   Alert Modal
   ============================================ */

export const AlertModal = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'OK',
  variant = 'info',
}: AlertModalProps) => {
  const variantStyles = {
    info: { icon: 'ℹ️', color: 'text-info' },
    success: { icon: '✅', color: 'text-success' },
    warning: { icon: '⚠️', color: 'text-warning' },
    error: { icon: '❌', color: 'text-danger' },
  };

  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4 text-center">
        <span className="text-5xl" role="img" aria-hidden="true">{style.icon}</span>
        <div>
          <p className="text-surface-600 dark:text-surface-400">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary w-full max-w-xs mx-auto"
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================
   Drawer (Side Panel)
   ============================================ */

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const Drawer = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = 'right',
  size = 'md',
  className,
}: DrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-4xl',
  };

  const sideClasses = side === 'left' ? 'left-0' : 'right-0';

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={clsx(
          'fixed inset-y-0 z-50 flex flex-col modal-content',
          size === 'sm' && 'w-72',
          size === 'md' && 'w-96',
          size === 'lg' && 'max-w-lg',
          size === 'full' && 'max-w-4xl',
          side === 'left' ? 'left-0' : 'right-0',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        aria-describedby={description ? 'drawer-description' : undefined}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 p-4 border-b border-surface-200 dark:border-surface-700">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id="drawer-title" className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {title}
                </h2>
              )}
              {description && (
                <p id="drawer-description" className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-icon-md flex-shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

Drawer.displayName = 'Drawer';

/* ============================================
   Toast System
   ============================================ */

/* ============================================
   Toast System
   ============================================ */

export const Toast = ({ id, message, variant = 'info', duration = 5000, onClose, action }: ToastProps) => {
  const [visible, setVisible] = React.useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  const variantStyles = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  const icons = {
    success: <Check className="w-5 h-5 text-success" />,
    error: (
      <svg className="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586 6.707 6.707a1 1 0 00-1.414 1.414l3.293 3.293z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm1-8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-info" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-5a1 1 0 011 1v5a1 1 0 11-2 0V6a1 1 0 011-1zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    ),
  };

  return (
    <div
      className={clsx('toast', 'toast-container', 'animate-slide-in-right', variantStyles)}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0" aria-hidden="true">
          {icons[variant]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
            {action && <strong>{action.label}</strong>}
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="btn btn-ghost btn-icon-sm flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const icons = {
  success: <Check className="w-5 h-5 text-success" />,
  error: (
    <svg className="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586 6.707 6.707a1 1 0 00-1.414 1.414l3.293 3.293z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm1-8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-info" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-5a1 1 0 011 1v5a1 1 0 11-2 0V6a1 1 0 011-1zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

const variantStyles = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
};

/* ============================================
   Toast System
   ============================================ */

interface ToastContextValue {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast = { ...toast, id } as ToastProps;
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

/* ============================================
   Exports
   ============================================ */

export * from './Button';
export * from './Input';
export * from './Modal';