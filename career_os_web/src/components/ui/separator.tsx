import * as stylex from '@stylexjs/stylex';
import type { HTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  xstyle?: AppStyles;
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({
  className,
  xstyle,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  return (
    <div
      {...withClassName(
        [
          styles.base,
          orientation === 'horizontal' ? styles.horizontal : styles.vertical,
          xstyle,
        ],
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

const styles = stylex.create({
  base: {
    backgroundColor: 'color-mix(in oklab, hsl(var(--border)) 60%, transparent)',
  },
  horizontal: {
    height: '1px',
    width: '100%',
  },
  vertical: {
    height: '100%',
    width: '1px',
  },
});
