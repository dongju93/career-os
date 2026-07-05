import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      // Mirror Input: the visual error state also exposes aria-invalid so the
      // control announces as invalid without per-call-site wiring.
      aria-invalid={error || undefined}
      className={cn(
        'input-clean min-h-24 w-full rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none',
        error && 'border-red-400/60 focus-visible:ring-red-400/20',
        className,
      )}
      {...props}
    />
  );
}
