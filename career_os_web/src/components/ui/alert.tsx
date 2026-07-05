import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default: 'glass-light border-white/10 text-foreground',
        destructive: 'bg-red-500/10 border-red-400/20 text-red-300',
        success: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300',
        warning: 'bg-amber-500/10 border-amber-400/20 text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

// Error-class variants interrupt (assertive); informational variants wait for a
// pause (polite). Callers can still override role / aria-live explicitly.
function isAssertiveVariant(variant: AlertProps['variant']): boolean {
  return variant === 'destructive' || variant === 'warning';
}

export function Alert({
  className,
  variant,
  role,
  'aria-live': ariaLive,
  ...props
}: AlertProps) {
  const assertive = isAssertiveVariant(variant);
  return (
    <div
      aria-live={ariaLive ?? (assertive ? 'assertive' : 'polite')}
      className={cn(alertVariants({ variant }), className)}
      role={role ?? (assertive ? 'alert' : 'status')}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn(
        'mb-1 font-semibold leading-none tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  );
}
