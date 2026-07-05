import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      // `error` drives the visual state and the semantic invalid state together,
      // so a screen reader hears "invalid" without callers wiring aria manually.
      aria-invalid={error || undefined}
      className={cn(
        'input-clean h-10 w-full rounded-xl px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all',
        error && 'border-red-400/60 focus-visible:ring-red-400/20',
        className,
      )}
      {...props}
    />
  );
}
