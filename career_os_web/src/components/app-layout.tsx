import { AppShell, Badge, Burger, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, NavLink as RouterNavLink } from 'react-router';
import { useWorkspaceStore } from '../store/workspace-store';
import '../App.css';

const navigationItems = [
  {
    to: '/',
    label: 'Overview',
    hint: 'Configured runtime and UI shell',
  },
  {
    to: '/tooling',
    label: 'Tooling',
    hint: 'Testing, state, and styling setup',
  },
];

export function AppLayout() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const sharedCount = useWorkspaceStore((state) => state.sharedCount);

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        breakpoint: 'md',
        collapsed: { mobile: !opened },
        width: 292,
      }}
      padding={0}
    >
      <AppShell.Header className="app-header">
        <Group h="100%" justify="space-between" px="lg">
          <Group gap="sm">
            <div className="app-mark">CO</div>
            <Stack gap={0}>
              <Text c="white" fw={700} size="sm">
                Career OS Web
              </Text>
              <Text c="rgba(255,255,255,0.68)" size="xs">
                Mantine, Router, Zustand, Tailwind, Vitest, Playwright
              </Text>
            </Stack>
          </Group>

          <Group gap="sm">
            <Badge color="orange" size="lg" variant="light">
              {sharedCount} synced state
            </Badge>
            <Burger
              color="white"
              hiddenFrom="md"
              onClick={toggle}
              opened={opened}
              size="sm"
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="app-navbar" p="md">
        <Stack gap="md">
          <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/78 p-4 shadow-[0_24px_55px_-48px_rgba(15,23,42,0.35)] backdrop-blur">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Starter status
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              All installed packages are connected to a working baseline.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Navigate between pages to verify routing, shared state, styled
              components, utility classes, unit tests, and E2E coverage.
            </p>
          </div>

          <nav className="flex flex-col gap-2">
            {navigationItems.map((item) => (
              <RouterNavLink
                key={item.to}
                aria-label={item.label}
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? 'is-active' : ''}`
                }
                onClick={close}
                to={item.to}
              >
                <span className="app-nav-link__title">{item.label}</span>
                <span className="app-nav-link__hint">{item.hint}</span>
              </RouterNavLink>
            ))}
          </nav>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
