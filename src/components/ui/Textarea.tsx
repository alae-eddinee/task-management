'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full px-3 py-2
            bg-white border border-[var(--border)] rounded-lg
            text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
            transition-all duration-160
            disabled:bg-[var(--background-secondary)] disabled:cursor-not-allowed
            resize-none
            ${error ? 'border-[var(--danger)]' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
