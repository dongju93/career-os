import * as stylex from '@stylexjs/stylex';
import type { InputHTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  xstyle?: AppStyles;
  error?: boolean;
}

export function Input({ className, xstyle, error, ...props }: InputProps) {
  return (
    <input
      // `error` drives the visual state and the semantic invalid state together,
      // so a screen reader hears "invalid" without callers wiring aria manually.
      aria-invalid={error || undefined}
      {...withClassName(
        [styles.base, surfaces.inputClean, error && styles.invalid, xstyle],
        className,
      )}
      {...props}
    />
  );
}

const styles = stylex.create({
  base: {
    height: '2.5rem',
    width: '100%',
    borderRadius: '.75rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    '::placeholder': {
      color: 'hsl(var(--muted-foreground))',
    },
    outlineStyle: {
      default: null,
      ':focus-visible': 'none',
    },
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    opacity: {
      default: null,
      ':disabled': 0.5,
    },
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  invalid: {
    borderColor:
      'color-mix(in oklab, oklch(70.4% .191 22.216) 60%, transparent)',
    outlineColor: {
      default: null,
      ':focus-visible':
        'color-mix(in oklab, oklch(70.4% .191 22.216) 20%, transparent)',
    },
  },
});
