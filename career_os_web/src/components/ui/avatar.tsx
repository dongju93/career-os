import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as stylex from '@stylexjs/stylex';
import type { ComponentPropsWithoutRef } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';

export function AvatarRoot({
  className,
  xstyle,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
  xstyle?: AppStyles;
}) {
  return (
    <AvatarPrimitive.Root
      {...withClassName([styles.root, xstyle], className)}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  xstyle,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & {
  xstyle?: AppStyles;
}) {
  return (
    <AvatarPrimitive.Image
      {...withClassName([styles.image, xstyle], className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  xstyle,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
  xstyle?: AppStyles;
}) {
  return (
    <AvatarPrimitive.Fallback
      {...withClassName([styles.fallback, xstyle], className)}
      {...props}
    />
  );
}

const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'flex',
    height: '2.5rem',
    width: '2.5rem',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '9999px',
    outlineWidth: '1px',
    outlineStyle: 'solid',
    outlineColor: 'oklch(87.2% .01 258.338)',
    outlineOffset: '0px',
    backgroundColor: 'oklch(92.8% .006 264.531)',
  },
  image: {
    aspectRatio: '1 / 1',
    height: '100%',
    width: '100%',
    objectFit: 'cover',
  },
  fallback: {
    display: 'flex',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, hsl(var(--primary)) 30%, transparent), color-mix(in oklab, hsl(var(--primary)) 15%, transparent))',
    color: 'hsl(var(--primary))',
    fontWeight: 600,
    fontSize: '.875rem',
    lineHeight: '1.25rem',
  },
});
