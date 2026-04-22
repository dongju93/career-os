import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'glass-light text-primary border',
        secondary: 'glass-light text-gray-600 border',
        destructive: 'bg-red-500/15 text-red-300 border-red-400/25',
        outline: 'glass-light text-foreground border-white/15',
        saramin: 'bg-orange-400/15 text-orange-300 border-orange-400/25',
        wanted: 'bg-teal-400/15 text-teal-300 border-teal-400/25',
        glass: 'glass-light text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
