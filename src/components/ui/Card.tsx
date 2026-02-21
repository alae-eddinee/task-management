'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`
      bg-white border border-[var(--border)] rounded-xl
      shadow-sm hover:shadow-md transition-shadow duration-160
      ${paddingStyles[padding]}
      ${className}
    `}>
      {children}
    </div>
  );
}
