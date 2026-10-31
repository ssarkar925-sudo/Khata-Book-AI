'use client';

import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

/* ============================================
   Input
   ============================================ */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      className,
      id: providedId,
      disabled,
      required,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    return (
      <div className={clsx(fullWidth && 'w-full', 'flex flex-col gap-1.5')}>
        {label && (
          <label htmlFor={id} className="label">
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-surface-400 dark:text-surface-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={clsx(hasError && errorId, hasHelper && helperId)}
            className={clsx(
              'input',
              fullWidth && 'w-full',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              hasError && 'input-error',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-surface-400 dark:text-surface-500">
              {rightIcon}
            </div>
          )}
        </div>

        {hasError && (
          <p id={errorId} className="text-xs text-danger flex items-center gap-1" role="alert">
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {hasHelper && !hasError && (
          <p id={helperId} className="text-xs text-surface-500 dark:text-surface-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/* ============================================
   Textarea
   ============================================ */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      className,
      id: providedId,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    return (
      <div className={clsx(fullWidth && 'w-full', 'flex flex-col gap-1.5')}>
        {label && (
          <label htmlFor={id} className="label">
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={clsx(hasError && errorId, hasHelper && helperId)}
          className={clsx('input', fullWidth && 'w-full', hasError && 'input-error', className)}
          {...props}
        />

        {hasError && (
          <p id={errorId} className="text-xs text-danger flex items-center gap-1" role="alert">
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {hasHelper && !hasError && (
          <p id={helperId} className="text-xs text-surface-500 dark:text-surface-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

/* ============================================
   Select
   ============================================ */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      fullWidth = true,
      className,
      id: providedId,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    return (
      <div className={clsx(fullWidth && 'w-full', 'flex flex-col gap-1.5')}>
        {label && (
          <label htmlFor={id} className="label">
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={clsx(hasError && errorId, hasHelper && helperId)}
            className={clsx('input', fullWidth && 'w-full', hasError && 'input-error', className)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-surface-400 dark:text-surface-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {error && (
          <p id={errorId} className="text-xs text-danger flex items-center gap-1" role="alert">
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {hasHelper && !error && (
          <p id={helperId} className="text-xs text-surface-500 dark:text-surface-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

/* ============================================
   Label
   ============================================ */

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, children, className, ...props }, ref) => (
    <label
      ref={ref}
      className={clsx('label', className)}
      {...props}
    >
      {children}
      {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
    </label>
  )
);

Label.displayName = 'Label';

/* ============================================
   Field Wrapper (Composes Label + Input + Error + Helper)
   ============================================ */

export interface FieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Field = ({ label, error, helperText, required, children, className }: FieldProps) => (
  <div className={clsx('flex flex-col gap-1.5', className)}>
    {label && (
      <label className="label">
        {label}
        {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {error && (
      <p className="text-xs text-danger flex items-center gap-1" role="alert">
        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
        </svg>
        <span>{error}</span>
      </p>
    )}
    {helperText && !error && (
      <p className="text-xs text-surface-500 dark:text-surface-400">{helperText}</p>
    )}
  </div>
);

Field.displayName = 'Field';

/* ============================================
   FieldSet (for grouping related fields)
   ============================================ */

export interface FieldSetProps {
  legend?: string;
  children: React.ReactNode;
  className?: string;
}

export const FieldSet = ({ legend, children, className }: FieldSetProps) => (
  <fieldset className={clsx('flex flex-col gap-4', className)}>
    {legend && <legend className="text-sm font-semibold text-surface-900 dark:text-surface-100">{legend}</legend>}
    <div className="space-y-4">{children}</div>
  </fieldset>
);

FieldSet.displayName = 'FieldSet';