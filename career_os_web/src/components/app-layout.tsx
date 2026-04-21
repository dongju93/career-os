import { AppShell, Burger, Group, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, NavLink as RouterNavLink, useNavigate } from 'react-router';
import { logoutUser } from '../services/auth';
import { useAuthStore } from '../store/auth-store';
import '../App.css';

const navigationItems = [
  {
    to: '/job-postings',
    label: '채용공고',
    hint: '저장한 채용공고 목록',
  },
];

export function AppLayout() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  async function handleLogout() {
    if (token) {
      await logoutUser(token).catch(() => {});
    }
    clearAuth();
    navigate('/login', { replace: true });
  }

  const userInitial = (user?.name ?? user?.email ?? 'U')
    .charAt(0)
    .toUpperCase();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        breakpoint: 'md',
        collapsed: { mobile: !opened },
        width: 260,
      }}
      padding={0}
    >
      <AppShell.Header className="app-header">
        <Group h="100%" justify="space-between" px="lg">
          <Group gap="sm">
            <div className="brand-icon">CO</div>
            <span className="brand-name">Career OS</span>
          </Group>

          <Group gap="sm">
            {user && (
              <Group gap="xs" visibleFrom="sm">
                <Text c="dimmed" size="sm">
                  {user.name ?? user.email}
                </Text>
                <div className="user-avatar">
                  {user.picture ? (
                    <img
                      alt={user.name ?? ''}
                      referrerPolicy="no-referrer"
                      src={user.picture}
                    />
                  ) : (
                    userInitial
                  )}
                </div>
              </Group>
            )}
            <Burger
              hiddenFrom="md"
              onClick={toggle}
              opened={opened}
              size="sm"
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="app-navbar" p="md">
        <div className="flex flex-col h-full">
          <nav className="flex flex-col gap-1.5 flex-1">
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

          <div className="nav-footer">
            {user && (
              <div className="nav-user-row">
                <div className="user-avatar nav-user-avatar">
                  {user.picture ? (
                    <img
                      alt={user.name ?? ''}
                      referrerPolicy="no-referrer"
                      src={user.picture}
                    />
                  ) : (
                    (user.name ?? user.email ?? 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <span className="nav-user-name">{user.name ?? user.email}</span>
              </div>
            )}
            <UnstyledButton className="logout-button" onClick={handleLogout}>
              로그아웃
            </UnstyledButton>
          </div>
        </div>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
