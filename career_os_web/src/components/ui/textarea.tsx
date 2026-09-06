import * as stylex from '@stylexjs/stylex';
import type { TextareaHTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  xstyle?: AppStyles;
  error?: boolean;
}

export function Textarea({
  className,
  xstyle,
  error,
  ...props
}: TextareaProps) {
  return (
    <textarea
      // Mirror Input: the visual error state also exposes aria-invalid so the
      // control announces as invalid without per-call-site wiring.
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
    minHeight: '6rem',
    width: '100%',
    borderRadius: '.75rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.75rem',
    paddingBottom: '0.75rem',
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
    resize: 'none',
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
