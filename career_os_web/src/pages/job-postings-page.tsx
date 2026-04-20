import {
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { fetchJobPostings } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import type { JobPostingListItem } from '../types/job-posting';

const PLATFORM_LABELS: Record<string, string> = {
  saramin: '사람인',
  wanted: '원티드',
};

const PLATFORM_COLORS: Record<string, string> = {
  saramin: 'orange',
  wanted: 'teal',
};

function JobPostingCard({ item }: { item: JobPostingListItem }) {
  const platformLabel = PLATFORM_LABELS[item.platform] ?? item.platform;
  const platformColor = PLATFORM_COLORS[item.platform] ?? 'gray';
  const addedAt = new Date(item.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card padding="lg" radius="xl" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Badge color={platformColor} radius="xl" size="sm" variant="light">
            {platformLabel}
          </Badge>
          <Text c="dimmed" size="xs">
            {addedAt} 저장
          </Text>
        </Group>

        <div>
          <Text fw={600} size="sm" c="dimmed">
            {item.company_name}
          </Text>
          <Anchor
            href={item.posting_url}
            rel="noopener noreferrer"
            size="md"
            target="_blank"
            fw={700}
            c="dark"
            underline="hover"
          >
            {item.job_title}
          </Anchor>
        </div>

        <Group gap="xs" wrap="wrap">
          {item.location && (
            <Text size="xs" c="dimmed">
              📍 {item.location}
            </Text>
          )}
          {item.experience_req && (
            <Text size="xs" c="dimmed">
              · {item.experience_req}
            </Text>
          )}
          {item.employment_type && (
            <Text size="xs" c="dimmed">
              · {item.employment_type}
            </Text>
          )}
        </Group>

        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" fw={500} c={item.deadline ? 'red.7' : 'dimmed'}>
            {item.deadline ? `마감 ${item.deadline}` : '마감일 미정'}
          </Text>
          {item.salary && (
            <Text size="sm" c="dimmed">
              {item.salary}
            </Text>
          )}
        </Group>

        {item.tech_stack && item.tech_stack.length > 0 && (
          <Group gap={4} wrap="wrap">
            {item.tech_stack.slice(0, 6).map((tech) => (
              <Badge
                key={tech}
                color="gray"
                radius="xl"
                size="xs"
                variant="outline"
              >
                {tech}
              </Badge>
            ))}
            {item.tech_stack.length > 6 && (
              <Badge color="gray" radius="xl" size="xs" variant="outline">
                +{item.tech_stack.length - 6}
              </Badge>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}

const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f'];

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SKELETON_KEYS.map((key) => (
        <Card key={key} padding="lg" radius="xl" withBorder>
          <Stack gap="xs">
            <Skeleton height={20} radius="xl" width={80} />
            <Skeleton height={14} mt={4} radius="sm" width="55%" />
            <Skeleton height={20} radius="sm" width="85%" />
            <Skeleton height={14} radius="sm" width="65%" />
            <Skeleton height={14} radius="sm" width="40%" />
          </Stack>
        </Card>
      ))}
    </div>
  );
}

export function JobPostingsPage() {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    fetchJobPostings(token)
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>저장한 채용공고</Title>
        {!isLoading && !error && (
          <Text c="dimmed" mt={4} size="sm">
            총 {total}개의 채용공고가 저장되어 있습니다.
          </Text>
        )}
      </div>

      {isLoading && <LoadingSkeleton />}

      {!isLoading && error && (
        <Alert color="red" radius="xl" title="불러오기 실패" variant="light">
          {error}
        </Alert>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card padding="xl" radius="xl" withBorder>
          <Stack align="center" gap="md" py="xl">
            <Text size="3xl">📋</Text>
            <Title order={3} ta="center">
              저장된 채용공고가 없습니다
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              채용공고 URL을 등록하면 여기에 표시됩니다.
            </Text>
          </Stack>
        </Card>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <JobPostingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </Stack>
  );
}
