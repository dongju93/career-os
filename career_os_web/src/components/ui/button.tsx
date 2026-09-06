import { Slot, Slottable } from '@radix-ui/react-slot';
import * as stylex from '@stylexjs/stylex';
import type { ButtonHTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { motion } from '@/styles/motion';
import { surfaces } from '@/styles/surfaces';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  xstyle?: AppStyles;
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  className,
  xstyle,
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
      {...withClassName(
        [
          baseStyle,
          sizeStyles[size ?? 'default'],
          !asChild && styles.nativeTypography,
          variantStyles[variant ?? 'default'],
          xstyle,
        ],
        className,
      )}
      disabled={!asChild ? (disabled ?? loading) : undefined}
      {...props}
    >
      {loading ? (
        <svg
          aria-hidden="true"
          {...stylex.props(motion.spin)}
          fill="none"
          height={16}
          viewBox="0 0 24 24"
          width={16}
        >
          <circle
            {...stylex.props(styles.spinnerTrack)}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            {...stylex.props(styles.spinnerArc)}
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

const styles = stylex.create({
  nativeTypography: {
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontWeight: 'inherit',
  },
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
    borderRadius: '.75rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 600,
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
    outlineStyle: {
      default: null,
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: null,
      ':focus-visible': '2px',
    },
    outlineColor: {
      default: null,
      ':focus-visible': 'hsl(var(--ring))',
    },
    outlineOffset: {
      default: null,
      ':focus-visible': '2px',
    },
    pointerEvents: {
      default: null,
      ':disabled': 'none',
    },
    opacity: {
      default: null,
      ':disabled': 0.5,
    },
    scale: {
      default: null,
      ':active': '0.97',
    },
  },
  destructive: {
    backgroundColor: {
      default: 'oklch(63.7% .237 25.331)',
      ':hover': 'oklch(70.4% .191 22.216)',
    },
    color: '#fff',
    boxShadow:
      '0 1px 3px 0 color-mix(in oklab, oklch(63.7% .237 25.331) 25%, transparent), 0 1px 2px -1px color-mix(in oklab, oklch(63.7% .237 25.331) 25%, transparent)',
  },
  secondary: {
    color: 'hsl(var(--foreground))',
    backgroundColor: {
      default: null,
      ':hover': 'color-mix(in oklab, #fff 15%, transparent)',
    },
  },
  link: {
    color: 'hsl(var(--primary))',
    textUnderlineOffset: '4px',
    textDecorationLine: {
      default: null,
      ':hover': 'underline',
    },
  },
  glass: {
    color: 'hsl(var(--foreground))',
    backgroundColor: {
      default: null,
      ':hover': 'color-mix(in oklab, #fff 15%, transparent)',
    },
  },
  defaultSize: {
    height: '2.5rem',
    paddingLeft: '1.25rem',
    paddingRight: '1.25rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
  },
  small: {
    height: '2.25rem',
    borderRadius: '.5rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
  },
  large: {
    height: '2.75rem',
    borderRadius: '.75rem',
    paddingLeft: '2rem',
    paddingRight: '2rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  iconSize: {
    height: '2.5rem',
    width: '2.5rem',
  },
  spinnerTrack: {
    opacity: 0.25,
  },
  spinnerArc: {
    opacity: 0.75,
  },
});

const baseStyle = styles.base;

const variantStyles = {
  default: surfaces.btnPrimary,
  destructive: styles.destructive,
  outline: surfaces.btnSecondary,
  secondary: [styles.secondary, surfaces.glassLight],
  ghost: surfaces.btnGhost,
  link: styles.link,
  glass: [styles.glass, surfaces.glass],
};

const sizeStyles = {
  default: styles.defaultSize,
  sm: styles.small,
  lg: styles.large,
  icon: styles.iconSize,
};
