import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Card className="panel-card max-w-2xl" padding="xl" radius="xl">
      <Stack gap="md">
        <Text className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
          Not found
        </Text>
        <Title order={1}>This route is not configured.</Title>
        <Text className="text-base leading-7 text-slate-600">
          The router now has a catch-all page, so missing URLs fail in a defined
          way instead of leaving the app blank.
        </Text>
        <Button onClick={() => navigate('/')} size="md">
          Return to overview
        </Button>
      </Stack>
    </Card>
  );
}
