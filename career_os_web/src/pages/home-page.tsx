import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router';
import { stackPackages } from '../data/stack-packages';
import { useWorkspaceStore } from '../store/workspace-store';

export function HomePage() {
  const navigate = useNavigate();
  const sharedCount = useWorkspaceStore((state) => state.sharedCount);
  const highlightedPackage = useWorkspaceStore(
    (state) => state.highlightedPackage,
  );
  const incrementSharedCount = useWorkspaceStore(
    (state) => state.incrementSharedCount,
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="hero-card" padding="xl" radius="xl">
          <Stack gap="xl">
            <div className="space-y-4">
              <Badge color="orange" radius="xl" size="lg" variant="light">
                Working baseline
              </Badge>
              <Title
                className="max-w-3xl text-4xl leading-tight md:text-5xl"
                order={1}
              >
                All installed packages are now wired into the app.
              </Title>
              <Text className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                Mantine drives the shell and theme, React Router owns
                navigation, Zustand keeps shared state, Tailwind handles utility
                styling, and the test stack is configured for unit and E2E
                coverage.
              </Text>
            </div>

            <div className="flex flex-wrap gap-2">
              {stackPackages.map((item) => (
                <Badge key={item.id} color="dark" radius="xl" variant="dot">
                  {item.label}
                </Badge>
              ))}
            </div>

            <Group>
              <Button onClick={incrementSharedCount} size="md">
                Increase shared state
              </Button>
              <Button
                onClick={() => navigate('/tooling')}
                size="md"
                variant="default"
              >
                Review tooling setup
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card className="panel-card" padding="xl" radius="xl">
          <Stack gap="lg" h="100%" justify="space-between">
            <div className="space-y-3">
              <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                Shared state demo
              </Text>
              <Title order={2}>Zustand state persists across routes.</Title>
              <Text className="text-sm leading-6 text-slate-600">
                The header badge and this panel are both reading from the same
                store, so navigating to the tooling page preserves the current
                count and highlighted package.
              </Text>
            </div>

            <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/70 p-5">
              <Text className="text-sm font-medium text-slate-500">
                Shared counter
              </Text>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-950">
                {sharedCount}
              </p>
              <Text className="mt-3 text-sm leading-6 text-slate-600">
                Current highlighted area:
                <span className="ml-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-900">
                  {highlightedPackage}
                </span>
              </Text>
            </div>
          </Stack>
        </Card>
      </div>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <Card className="panel-card" padding="lg" radius="xl">
          <Stack gap="md">
            <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Routing
            </Text>
            <Title order={3}>Nested routes are active.</Title>
            <Text className="text-sm leading-6 text-slate-600">
              The app now renders through a shared layout with route-aware
              navigation and a catch-all not-found page.
            </Text>
            <Progress color="orange" radius="xl" size="lg" value={100} />
          </Stack>
        </Card>

        <Card className="panel-card" padding="lg" radius="xl">
          <Stack gap="md">
            <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Styling
            </Text>
            <Title order={3}>Mantine and Tailwind are both connected.</Title>
            <Text className="text-sm leading-6 text-slate-600">
              Mantine handles the component layer while Tailwind utilities shape
              page layout, spacing, and responsive composition.
            </Text>
            <Progress color="pink" radius="xl" size="lg" value={100} />
          </Stack>
        </Card>

        <Card className="panel-card" padding="lg" radius="xl">
          <Stack gap="md">
            <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Validation
            </Text>
            <Title order={3}>Unit and E2E tests are scaffolded.</Title>
            <Text className="text-sm leading-6 text-slate-600">
              Vitest covers component behavior in JSDOM and Playwright exercises
              the router flow against the running Vite dev server.
            </Text>
            <Progress color="grape" radius="xl" size="lg" value={100} />
          </Stack>
        </Card>
      </SimpleGrid>
    </>
  );
}
