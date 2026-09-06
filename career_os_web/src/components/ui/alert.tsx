import * as stylex from '@stylexjs/stylex';
import type { HTMLAttributes, ReactNode } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  xstyle?: AppStyles;
  variant?: keyof typeof variantStyles;
  icon?: ReactNode;
}

// Error-class variants interrupt (assertive); informational variants wait for a
// pause (polite). Callers can still override role / aria-live explicitly.
function isAssertiveVariant(variant: AlertProps['variant']): boolean {
  return variant === 'destructive' || variant === 'warning';
}

export function Alert({
  className,
  xstyle,
  variant,
  icon,
  children,
  role,
  'aria-live': ariaLive,
  ...props
}: AlertProps) {
  const assertive = isAssertiveVariant(variant);
  return (
    <div
      aria-live={ariaLive ?? (assertive ? 'assertive' : 'polite')}
      {...withClassName(
        [
          baseStyle,
          variantStyles[variant ?? 'default'],
          icon != null && styles.withIcon,
          xstyle,
        ],
        className,
      )}
      role={role ?? (assertive ? 'alert' : 'status')}
      {...props}
    >
      {icon != null && (
        <span aria-hidden="true" {...stylex.props(styles.icon)}>
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

export function AlertTitle({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { xstyle?: AppStyles }) {
  return (
    <h5 {...withClassName([styles.heading, xstyle], className)} {...props} />
  );
}

export function AlertDescription({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { xstyle?: AppStyles }) {
  return (
    <p {...withClassName([styles.description, xstyle], className)} {...props} />
  );
}

const styles = stylex.create({
  icon: { position: 'absolute', left: '1rem', top: '1rem' },
  withIcon: { paddingLeft: '2.75rem' },
  base: {
    position: 'relative',
    width: '100%',
    borderRadius: '.75rem',
    borderWidth: '1px',
    paddingTop: '1rem',
    paddingRight: '1rem',
    paddingBottom: '1rem',
    paddingLeft: '1rem',
  },
  default: {
    borderColor: 'color-mix(in oklab, #fff 10%, transparent)',
    color: 'hsl(var(--foreground))',
  },
  destructive: {
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 10%, transparent)',
    borderColor:
      'color-mix(in oklab, oklch(70.4% .191 22.216) 20%, transparent)',
    color: 'oklch(80.8% .114 19.571)',
  },
  success: {
    backgroundColor:
      'color-mix(in oklab, oklch(69.6% .17 162.48) 10%, transparent)',
    borderColor:
      'color-mix(in oklab, oklch(76.5% .177 163.223) 20%, transparent)',
    color: 'oklch(84.5% .143 164.978)',
  },
  warning: {
    backgroundColor:
      'color-mix(in oklab, oklch(76.9% .188 70.08) 10%, transparent)',
    borderColor:
      'color-mix(in oklab, oklch(82.8% .189 84.429) 20%, transparent)',
    color: 'oklch(87.9% .169 91.605)',
  },
  heading: {
    marginBottom: '0.25rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-.02em',
  },
  description: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
  },
});

const baseStyle = styles.base;

const variantStyles = {
  default: [styles.default, surfaces.glassLight],
  destructive: styles.destructive,
  success: styles.success,
  warning: styles.warning,
};
