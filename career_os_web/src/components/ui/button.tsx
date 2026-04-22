import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'btn-primary',
        destructive:
          'bg-red-500 text-white hover:bg-red-400 shadow-sm shadow-red-500/25',
        outline: 'btn-secondary',
        secondary: 'glass-light text-foreground hover:bg-white/15',
        ghost: 'btn-ghost',
        link: 'text-primary underline-offset-4 hover:underline',
        glass: 'glass text-foreground hover:bg-white/15',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading,
  disabled,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={!asChild ? (disabled ?? loading) : undefined}
      {...props}
    >
      {loading ? (
        <svg
          aria-hidden="true"
          className="animate-spin"
          fill="none"
          height={16}
          viewBox="0 0 24 24"
          width={16}
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}
