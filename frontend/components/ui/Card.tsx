import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ className, padding = 'md', children, ...props }: CardProps) {
  const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900 shadow-sm',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
