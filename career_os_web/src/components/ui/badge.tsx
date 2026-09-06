import * as stylex from '@stylexjs/stylex';
import type { HTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  xstyle?: AppStyles;
  variant?: keyof typeof variantStyles;
}

export function Badge({ className, xstyle, variant, ...props }: BadgeProps) {
  return (
    <span
      {...withClassName(
        [baseStyle, variantStyles[variant ?? 'default'], xstyle],
        className,
      )}
      {...props}
    />
  );
}

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    borderWidth: '1px',
    paddingLeft: '0.625rem',
    paddingRight: '0.625rem',
    paddingTop: '0.125rem',
    paddingBottom: '0.125rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  default: {
    color: 'hsl(var(--primary))',
    borderWidth: '1px',
  },
  secondary: {
    color: 'oklch(44.6% .03 256.802)',
    borderWidth: '1px',
  },
  destructive: {
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 15%, transparent)',
    color: 'oklch(80.8% .114 19.571)',
    borderColor:
      'color-mix(in oklab, oklch(70.4% .191 22.216) 25%, transparent)',
  },
  success: {
    backgroundColor:
      'color-mix(in oklab, oklch(69.6% .17 162.48) 15%, transparent)',
    color: 'oklch(84.5% .143 164.978)',
    borderColor:
      'color-mix(in oklab, oklch(76.5% .177 163.223) 25%, transparent)',
  },
  warning: {
    backgroundColor:
      'color-mix(in oklab, oklch(76.9% .188 70.08) 15%, transparent)',
    color: 'oklch(87.9% .169 91.605)',
    borderColor:
      'color-mix(in oklab, oklch(82.8% .189 84.429) 25%, transparent)',
  },
  outline: {
    color: 'hsl(var(--foreground))',
    borderColor: 'color-mix(in oklab, #fff 15%, transparent)',
  },
  saramin: {
    backgroundColor:
      'color-mix(in oklab, oklch(75% .183 55.934) 15%, transparent)',
    color: 'oklch(83.7% .128 66.29)',
    borderColor: 'color-mix(in oklab, oklch(75% .183 55.934) 25%, transparent)',
  },
  wanted: {
    backgroundColor:
      'color-mix(in oklab, oklch(77.7% .152 181.912) 15%, transparent)',
    color: 'oklch(85.5% .138 181.071)',
    borderColor:
      'color-mix(in oklab, oklch(77.7% .152 181.912) 25%, transparent)',
  },
  glass: {
    color: 'hsl(var(--foreground))',
  },
});

const baseStyle = styles.base;

const variantStyles = {
  default: [styles.default, surfaces.glassLight],
  secondary: [styles.secondary, surfaces.glassLight],
  destructive: styles.destructive,
  success: styles.success,
  warning: styles.warning,
  outline: [styles.outline, surfaces.glassLight],
  saramin: styles.saramin,
  wanted: styles.wanted,
  glass: [styles.glass, surfaces.glassLight],
};
