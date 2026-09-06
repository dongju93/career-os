import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';

interface LiveRegionProps {
  children?: ReactNode;
  /**
   * `polite` waits for the screen reader to pause (busy/success states);
   * `assertive` interrupts immediately (use sparingly, for errors).
   */
  politeness?: 'polite' | 'assertive';
  className?: string;
  xstyle?: AppStyles;
}

/**
 * A visually-hidden ARIA live region for transient status that has no visible
 * Alert of its own — e.g. "저장 중…" busy states conveyed only by a spinner.
 *
 * Mount it persistently and toggle its `children`: announcing on content change
 * (rather than on mount) is what screen readers reliably pick up. Rendering it
 * empty when idle keeps the region alive so the next message is announced.
 */
export function LiveRegion({
  children,
  politeness = 'polite',
  className,
  xstyle,
}: LiveRegionProps) {
  return (
    <div
      aria-atomic="true"
      aria-live={politeness}
      {...withClassName([styles.hidden, xstyle], className)}
      role={politeness === 'assertive' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

const styles = stylex.create({
  hidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
});
