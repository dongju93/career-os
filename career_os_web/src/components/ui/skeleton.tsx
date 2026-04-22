import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-linear-to-r from-muted/60 via-muted to-muted/60 bg-size-[200%_100%]',
        className,
      )}
      {...props}
    />
  );
}
