import * as stylex from '@stylexjs/stylex';
import type { HTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { motion } from '@/styles/motion';

export function Skeleton({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLDivElement> & { xstyle?: AppStyles }) {
  return (
    <div
      {...withClassName([styles.base, motion.pulse, xstyle], className)}
      {...props}
    />
  );
}

const styles = stylex.create({
  base: {
    borderRadius: '.5rem',
    backgroundImage:
      'linear-gradient(to right in oklab, color-mix(in oklab, #fff 8%, transparent), color-mix(in oklab, #fff 15%, transparent), color-mix(in oklab, #fff 8%, transparent))',
    backgroundSize: '200% 100%',
  },
});
