import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-linear-to-r from-white/8 via-white/15 to-white/8 bg-size-[200%_100%]',
        className,
      )}
      {...props}
    />
  );
}
