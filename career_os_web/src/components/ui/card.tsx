import * as stylex from '@stylexjs/stylex';
import type { HTMLAttributes } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  xstyle?: AppStyles;
  glass?: boolean;
  interactive?: boolean;
}

export function Card({
  className,
  xstyle,
  glass = true,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      {...withClassName(
        [
          styles.card,
          glass
            ? [
                surfaces.glass,
                interactive && [styles.interactiveCursor, surfaces.glassHover],
              ]
            : surfaces.surface,
          xstyle,
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLDivElement> & { xstyle?: AppStyles }) {
  return (
    <div
      data-stack=""
      {...withClassName([styles.header, xstyle], className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { xstyle?: AppStyles }) {
  return (
    <h3 {...withClassName([styles.title, xstyle], className)} {...props} />
  );
}

export function CardDescription({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { xstyle?: AppStyles }) {
  return (
    <p {...withClassName([styles.description, xstyle], className)} {...props} />
  );
}

export function CardContent({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLDivElement> & { xstyle?: AppStyles }) {
  return (
    <div {...withClassName([styles.content, xstyle], className)} {...props} />
  );
}

export function CardFooter({
  className,
  xstyle,
  ...props
}: HTMLAttributes<HTMLDivElement> & { xstyle?: AppStyles }) {
  return (
    <div {...withClassName([styles.footer, xstyle], className)} {...props} />
  );
}

const styles = stylex.create({
  card: {
    borderRadius: '1rem',
  },
  interactiveCursor: {
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    '--stack-space': '0.375rem',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  title: {
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  description: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'hsl(var(--muted-foreground))',
  },
  content: {
    paddingTop: '0rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: '0rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
});
