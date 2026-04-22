import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export function AvatarRoot({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-300 bg-gray-200',
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/15 text-primary font-semibold text-sm',
        className,
      )}
      {...props}
    />
  );
}
