'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md' | 'icon-lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isIconOnly = size.startsWith('icon-');
    const sizeClass = isIconOnly
      ? size === 'icon-sm' ? 'btn-icon-sm'
        : size === 'icon-md' ? 'btn-icon-md'
        : 'btn-icon-lg'
      : size === 'sm' ? 'btn-sm'
        : size === 'lg' ? 'btn-lg'
        : 'btn-md';

    const variantClass = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      success: 'btn-success',
    }[variant];

    const widthClass = fullWidth && !isIconOnly ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={clsx(
          'btn',
          variantClass,
          sizeClass,
          widthClass,
          loading && 'opacity-75 cursor-wait',
          className
        )}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <>
            {leftIcon && !loading && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
            <span className={clsx('truncate', isIconOnly && 'sr-only')}>{children}</span>
            {rightIcon && !loading && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/* ============================================
   Button Variants
   ============================================ */

export interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup = ({ children, className }: ButtonGroupProps) => (
  <div className={clsx('inline-flex items-center gap-2', className)} role="group">
    {children}
  </div>
);

/* ============================================
   Icon Button
   ============================================ */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'ghost', 'aria-label': ariaLabel, className, children, ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'btn-icon-sm' : size === 'lg' ? 'btn-icon-lg' : 'btn-icon-md';
    const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost';

    return (
      <button
        ref={ref}
        type="button"
        className={clsx('btn', variantClass, sizeClass, className)}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}