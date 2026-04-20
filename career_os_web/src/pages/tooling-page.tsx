import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { stackPackages } from '../data/stack-packages';
import { useWorkspaceStore } from '../store/workspace-store';

export function ToolingPage() {
  const highlightedPackage = useWorkspaceStore(
    (state) => state.highlightedPackage,
  );
  const selectPackage = useWorkspaceStore((state) => state.selectPackage);
  const sharedCount = useWorkspaceStore((state) => state.sharedCount);

  return (
    <Stack gap="xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Tooling and quality gates
          </Text>
          <Title order={1}>
            Each installed package now has a working entry point.
          </Title>
          <Text className="text-base leading-7 text-slate-600">
            This page maps packages to the files that activate them, so the repo
            has a concrete starting point instead of dormant dependencies.
          </Text>
        </div>

        <Card className="panel-card min-w-[18rem]" padding="lg" radius="xl">
          <Stack gap={6}>
            <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Persisted state
            </Text>
            <Text className="text-sm text-slate-600">Shared Zustand count</Text>
            <p className="text-4xl font-semibold tracking-tight text-slate-950">
              {sharedCount}
            </p>
            <Text className="text-sm text-slate-600">
              Highlighted package:
              <span className="ml-2 font-semibold text-slate-950">
                {highlightedPackage}
              </span>
            </Text>
          </Stack>
        </Card>
      </div>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {stackPackages.map((item) => {
          const isActive = highlightedPackage === item.id;

          return (
            <Card
              className="package-card"
              data-active={isActive}
              key={item.id}
              padding="xl"
              radius="xl"
            >
              <Stack gap="lg" h="100%" justify="space-between">
                <div className="space-y-4">
                  <Group justify="space-between">
                    <div>
                      <Title order={3}>{item.label}</Title>
                      <Text className="mt-1 text-sm leading-6 text-slate-600">
                        {item.purpose}
                      </Text>
                    </div>
                    <Badge color={isActive ? 'orange' : 'gray'} variant="light">
                      {isActive ? 'Focused' : 'Configured'}
                    </Badge>
                  </Group>

                  <Text className="text-sm leading-6 text-slate-600">
                    {item.reason}
                  </Text>

                  <div className="space-y-3">
                    <Text className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Packages
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {item.packages.map((packageName) => (
                        <Badge key={packageName} radius="xl" variant="dot">
                          {packageName}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Text className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Connected files
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {item.configFiles.map((file) => (
                        <Badge
                          color="dark"
                          key={file}
                          radius="sm"
                          variant="light"
                        >
                          {file}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => selectPackage(item.id)}
                  variant={isActive ? 'filled' : 'light'}
                >
                  {isActive ? 'Selected in store' : 'Highlight this setup'}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
