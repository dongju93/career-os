import * as stylex from '@stylexjs/stylex';
import type { LabelHTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';

export function Label({
  className,
  xstyle,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { xstyle?: AppStyles }) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- callers always pass htmlFor
    <label {...withClassName([styles.label, xstyle], className)} {...props} />
  );
}

const styles = stylex.create({
  label: {
    fontSize: '.875rem',
    lineHeight: 1,
    fontWeight: 500,
  },
});
