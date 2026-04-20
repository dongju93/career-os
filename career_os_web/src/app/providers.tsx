import { MantineProvider } from '@mantine/core';
import type { PropsWithChildren } from 'react';
import { appTheme } from './theme';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MantineProvider defaultColorScheme="light" theme={appTheme}>
      {children}
    </MantineProvider>
  );
}
