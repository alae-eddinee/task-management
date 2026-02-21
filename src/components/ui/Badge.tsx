'use client';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-[var(--primary)] text-white',
  secondary: 'bg-[var(--secondary)] text-white',
  success: 'bg-[var(--success)] text-white',
  danger: 'bg-[var(--danger)] text-white',
  warning: 'bg-[var(--warning)] text-white',
  info: 'bg-[var(--info)] text-white',
};

export function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5
      text-xs font-medium rounded-full
      ${variantStyles[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
}
