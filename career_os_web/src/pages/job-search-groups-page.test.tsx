import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { JobSearchGroupItem } from '../types/job-search-group';
import { formatLocalDateInputValue } from '../utils/local-date';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function groupsPageResponse(items: JobSearchGroupItem[]) {
  return {
    status: 200,
    message: 'ok',
    data: { items, total: items.length, offset: 0, limit: 100 },
  };
}

function groupDetailResponse(group: JobSearchGroupItem) {
  return { status: 200, message: 'ok', data: group };
}

const authMeBody = {
  status: 200,
  message: 'ok',
  data: {
    user_id: 'user-1',
    email: 'user@example.com',
    name: 'Career OS User',
    picture: null,
  },
};

const ACTIVE_GROUP_ID = '00000000-0000-7000-8000-000000000001';
const ENDED_GROUP_ID = '00000000-0000-7000-8000-000000000002';

const activeGroup: JobSearchGroupItem = {
  id: ACTIVE_GROUP_ID,
  name: '2026년 상반기 취업',
  started_at: '2026-01-01',
  ended_at: null,
  memo: null,
  posting_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const endedGroup: JobSearchGroupItem = {
  id: ENDED_GROUP_ID,
  name: '2025년 하반기 취업',
  started_at: '2025-07-01',
  ended_at: '2025-12-31',
  memo: '지난 구직 활동',
  posting_count: 5,
  created_at: '2025-07-01T00:00:00Z',
  updated_at: '2025-12-31T00:00:00Z',
};

function makeGroupsFetchMock(
  activeItems: JobSearchGroupItem[],
  endedItems: JobSearchGroupItem[],
  extras?: (input: string, init?: RequestInit) => Promise<unknown> | null,
) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
      return jsonResponse(authMeBody);
    }

    if (input.includes('/v1/job-search-groups')) {
      const extra = extras?.(input, init);
      if (extra !== null && extra !== undefined) return extra;

      const url = new URL(input, 'http://localhost');
      const status = url.searchParams.get('status');
      return jsonResponse(
        groupsPageResponse(status === 'ended' ? endedItems : activeItems),
      );
    }

    throw new Error(`Unexpected fetch: ${input}`);
  });
}

describe('JobSearchGroupsPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Career OS User',
      picture: null,
    });
  });

  it('shows active and ended groups in separate sections', async () => {
    vi.stubGlobal('fetch', makeGroupsFetchMock([activeGroup], [endedGroup]));

    renderRoute('/job-search-groups');

    expect(await screen.findByText('2026년 상반기 취업')).toBeInTheDocument();
    expect(screen.getByText('2025년 하반기 취업')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '진행 중인 구직 활동' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '지난 구직 활동' }),
    ).toBeInTheDocument();

    // Active group shows '현재' badge; ended group shows '종료' badge
    expect(screen.getByText('현재')).toBeInTheDocument();
    // Both the '종료' button (active card) and '종료' badge (ended card) are present
    expect(screen.getAllByText('종료').length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state when there are no active groups', async () => {
    vi.stubGlobal('fetch', makeGroupsFetchMock([], []));

    renderRoute('/job-search-groups');

    expect(
      await screen.findByText('진행 중인 구직 활동이 없습니다'),
    ).toBeInTheDocument();
    // Ended section is hidden when there are no ended groups
    expect(
      screen.queryByRole('heading', { name: '지난 구직 활동' }),
    ).not.toBeInTheDocument();
  });

  it('creates a new group via the modal and updates the list', async () => {
    const user = userEvent.setup();
    let postBody: Record<string, unknown> | null = null;

    const newGroup: JobSearchGroupItem = {
      ...activeGroup,
      id: 'group-new-1',
      name: '2026년 하반기 취업',
      posting_count: 0,
    };

    const fetchMock = makeGroupsFetchMock([activeGroup], [], (input, init) => {
      if (
        input === `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups` &&
        init?.method === 'POST'
      ) {
        postBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse(groupDetailResponse(newGroup)));
      }
      return null;
    });

    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/job-search-groups');

    await screen.findByText('2026년 상반기 취업');

    await user.click(
      screen.getAllByRole('button', { name: /새 구직 활동/i })[0],
    );

    const nameInput = await screen.findByPlaceholderText(
      '예: 2026년 상반기 취업',
    );
    await user.clear(nameInput);
    await user.type(nameInput, '2026년 하반기 취업');
    await user.click(screen.getByRole('button', { name: /^저장$/ }));

    await waitFor(() => {
      expect(postBody).toMatchObject({
        name: '2026년 하반기 취업',
        started_at: formatLocalDateInputValue(),
      });
    });
  });

  it('uses the shared dialog and field error accessibility contract', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', makeGroupsFetchMock([activeGroup], []));

    renderRoute('/job-search-groups');

    await screen.findByText('2026년 상반기 취업');
    await user.click(
      screen.getAllByRole('button', { name: /새 구직 활동/i })[0],
    );

    const dialog = await screen.findByRole('dialog', {
      name: '새 구직 활동',
    });
    const nameInput = within(dialog).getByRole('textbox', { name: '이름' });

    expect(
      within(dialog).getByRole('button', { name: '대화상자 닫기' }),
    ).toBeInTheDocument();

    await user.clear(nameInput);
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(nameInput).toHaveFocus());
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAccessibleDescription('그룹 이름을 입력해주세요.');

    await user.type(nameInput, '새 활동');

    expect(nameInput).not.toHaveAttribute('aria-invalid');
    expect(
      within(dialog).queryByText('그룹 이름을 입력해주세요.'),
    ).not.toBeInTheDocument();
  });

  it('ends an active group after inline confirmation', async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;

    const fetchMock = makeGroupsFetchMock([activeGroup], [], (input, init) => {
      if (
        input ===
          `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups/${ACTIVE_GROUP_ID}` &&
        init?.method === 'PATCH'
      ) {
        patchBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(
          jsonResponse(
            groupDetailResponse({ ...activeGroup, ended_at: '2026-05-16' }),
          ),
        );
      }
      return null;
    });

    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/job-search-groups');

    await screen.findByText('2026년 상반기 취업');

    await user.click(screen.getByRole('button', { name: /^종료$/ }));
    expect(screen.getByText('종료하시겠습니까?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^확인$/ }));

    await waitFor(() => {
      expect(patchBody).toMatchObject({
        ended_at: formatLocalDateInputValue(),
      });
    });
  });

  it('cancels the end confirmation without making a request', async () => {
    const user = userEvent.setup();
    const fetchMock = makeGroupsFetchMock([activeGroup], []);
    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-search-groups');

    await screen.findByText('2026년 상반기 취업');

    await user.click(screen.getByRole('button', { name: /^종료$/ }));
    expect(screen.getByText('종료하시겠습니까?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^취소$/ }));

    expect(screen.queryByText('종료하시겠습니까?')).not.toBeInTheDocument();
    // No PATCH call was made
    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  it('deletes a group after modal confirmation', async () => {
    const user = userEvent.setup();
    let deleteCallCount = 0;

    const fetchMock = makeGroupsFetchMock([activeGroup], [], (input, init) => {
      if (
        input ===
          `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups/${ACTIVE_GROUP_ID}` &&
        init?.method === 'DELETE'
      ) {
        deleteCallCount += 1;
        return Promise.resolve({
          ok: true,
          status: 204,
          json: async () => null,
        });
      }
      return null;
    });

    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/job-search-groups');

    await screen.findByText('2026년 상반기 취업');

    // Click delete on the card
    await user.click(screen.getByRole('button', { name: /삭제/i }));

    // Modal shows group name and posting count warning
    expect(
      await screen.findByText('저장된 채용공고 3개가 함께 삭제됩니다.'),
    ).toBeInTheDocument();

    // Click the destructive confirm button inside the modal
    const confirmButtons = screen.getAllByRole('button', { name: /삭제/i });
    const modalConfirm = confirmButtons.find(
      (btn) => btn.closest('[role="dialog"]') !== null,
    );
    await user.click(modalConfirm ?? confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(deleteCallCount).toBe(1);
    });
  });
});
