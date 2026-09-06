import * as stylex from '@stylexjs/stylex';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  FolderOpen,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import {
  createJobSearchGroup,
  deleteJobSearchGroup,
  fetchJobSearchGroups,
  updateJobSearchGroup,
} from '../services/job-search-groups';
import type { JobSearchGroupItem } from '../types/job-search-group';
import {
  formatLocalDateInputValue,
  parseLocalDateInputValue,
} from '../utils/local-date';

function todayLocalDateInputValue(): string {
  return formatLocalDateInputValue();
}

function formatDate(dateStr: string): string {
  return parseLocalDateInputValue(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; group: JobSearchGroupItem }
  | { type: 'delete'; group: JobSearchGroupItem };

type GroupFormError =
  | { type: 'name'; message: string }
  | { type: 'submit'; message: string };

const GROUP_NAME_INPUT_ID = 'job-search-group-name';
const GROUP_NAME_ERROR_ID = `${GROUP_NAME_INPUT_ID}-error`;
const GROUP_STARTED_AT_INPUT_ID = 'job-search-group-started-at';
const GROUP_ENDED_AT_INPUT_ID = 'job-search-group-ended-at';
const GROUP_ENDED_AT_DESCRIPTION_ID = `${GROUP_ENDED_AT_INPUT_ID}-description`;
const GROUP_MEMO_INPUT_ID = 'job-search-group-memo';

function GroupCardSkeleton() {
  return (
    <Card xstyle={styles.groupCardSkeletonCard} data-stack="">
      <Skeleton xstyle={styles.groupCardSkeletonSkeleton} />
      <Skeleton xstyle={styles.groupCardSkeletonSkeleton2} />
      <div {...stylex.props(styles.groupCardSkeletonRow)}>
        <Skeleton xstyle={styles.groupCardSkeletonSkeleton3} />
        <Skeleton xstyle={styles.groupCardSkeletonSkeleton4} />
        <Skeleton xstyle={styles.groupCardSkeletonSkeleton4} />
      </div>
    </Card>
  );
}

const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c'];

function GroupCard({
  group,
  isCurrent,
  isEnded,
  endingId,
  onViewPostings,
  onEdit,
  onEnd,
  onConfirmEnd,
  onCancelEnd,
  onDelete,
}: {
  group: JobSearchGroupItem;
  isCurrent: boolean;
  isEnded: boolean;
  endingId: string | null;
  onViewPostings: () => void;
  onEdit: () => void;
  onEnd?: () => void;
  onConfirmEnd?: () => void;
  onCancelEnd?: () => void;
  onDelete: () => void;
}) {
  const isConfirmingEnd = endingId === group.id;

  return (
    <Card xstyle={isEnded ? styles.groupCardCard : undefined}>
      <CardContent xstyle={styles.groupCardSkeletonCard} data-stack="">
        <div {...stylex.props(styles.groupCardRow)}>
          <div {...stylex.props(styles.groupCardRow2)}>
            <h3 {...stylex.props(styles.groupCardHeading)}>{group.name}</h3>
            {isCurrent && (
              <Badge variant="default" xstyle={styles.groupCardBadge}>
                현재
              </Badge>
            )}
            {isEnded && (
              <Badge variant="outline" xstyle={styles.groupCardBadge}>
                종료
              </Badge>
            )}
          </div>
          <Badge variant="secondary" xstyle={styles.groupCardBadge}>
            {group.posting_count}개 공고
          </Badge>
        </div>

        <div {...stylex.props(styles.groupCardRow3)}>
          <Calendar {...stylex.props(styles.groupCardCalendar)} />
          <span>
            {formatDate(group.started_at)} ~{' '}
            {group.ended_at ? formatDate(group.ended_at) : '진행 중'}
          </span>
        </div>

        {group.memo && (
          <p {...stylex.props(styles.groupCardDescription)}>{group.memo}</p>
        )}

        {isConfirmingEnd ? (
          <div {...stylex.props(styles.groupCardRow4)}>
            <span {...stylex.props(styles.groupCardText)}>
              종료하시겠습니까?
            </span>
            <Button size="sm" variant="destructive" onClick={onConfirmEnd}>
              확인
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEnd}>
              취소
            </Button>
          </div>
        ) : (
          <div {...stylex.props(styles.groupCardRow5)}>
            <Button size="sm" variant="outline" onClick={onViewPostings}>
              <Briefcase {...stylex.props(styles.groupCardBriefcase)} />
              공고 보기
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit}>
              수정
            </Button>
            {!isEnded && onEnd && (
              <Button size="sm" variant="outline" onClick={onEnd}>
                종료
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              xstyle={styles.groupCardButton}
              onClick={onDelete}
            >
              <Trash2 {...stylex.props(styles.groupCardBriefcase)} />
              삭제
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JobSearchGroupsPage() {
  useDocumentTitle('구직 활동');
  const navigate = useNavigate();

  const [activeGroups, setActiveGroups] = useState<JobSearchGroupItem[]>([]);
  const [endedGroups, setEndedGroups] = useState<JobSearchGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [formName, setFormName] = useState('');
  const [formStartedAt, setFormStartedAt] = useState(
    todayLocalDateInputValue(),
  );
  const [formEndedAt, setFormEndedAt] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formError, setFormError] = useState<GroupFormError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [endingGroupId, setEndingGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const [activeData, endedData] = await Promise.all([
        fetchJobSearchGroups({ status: 'active', limit: 100 }, signal),
        fetchJobSearchGroups({ status: 'ended', limit: 100 }, signal),
      ]);
      if (signal?.aborted) return;
      setActiveGroups(activeData.items);
      setEndedGroups(endedData.items);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(toUserFacingError(err, '그룹 목록을 불러오지 못했습니다.'));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadGroups(controller.signal);
    return () => controller.abort();
  }, [loadGroups]);

  function openCreateModal() {
    setFormName('');
    setFormStartedAt(todayLocalDateInputValue());
    setFormEndedAt('');
    setFormMemo('');
    setFormError(null);
    setModal({ type: 'create' });
  }

  function openEditModal(group: JobSearchGroupItem) {
    setFormName(group.name);
    setFormStartedAt(group.started_at);
    setFormEndedAt(group.ended_at ?? '');
    setFormMemo(group.memo ?? '');
    setFormError(null);
    setModal({ type: 'edit', group });
  }

  function openDeleteModal(group: JobSearchGroupItem) {
    setDeleteError(null);
    setModal({ type: 'delete', group });
  }

  function closeModal() {
    setModal({ type: 'closed' });
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formName.trim()) {
      setFormError({ type: 'name', message: '그룹 이름을 입력해주세요.' });
      requestAnimationFrame(() =>
        document.getElementById(GROUP_NAME_INPUT_ID)?.focus(),
      );
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload = {
      name: formName.trim(),
      started_at: formStartedAt || todayLocalDateInputValue(),
      ended_at: formEndedAt || null,
      memo: formMemo.trim() || null,
    };

    try {
      if (modal.type === 'create') {
        await createJobSearchGroup(payload);
      } else if (modal.type === 'edit') {
        await updateJobSearchGroup(modal.group.id, payload);
      }
      closeModal();
      await loadGroups();
    } catch (err) {
      const { message } = toUserFacingError(err, '저장에 실패했습니다.');
      setFormError({ type: 'submit', message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEndGroup(groupId: string) {
    setEndingGroupId(null);
    try {
      await updateJobSearchGroup(groupId, {
        ended_at: todayLocalDateInputValue(),
      });
      await loadGroups();
    } catch (err) {
      const { message } = toUserFacingError(err, '종료에 실패했습니다.');
      setError({ code: 'UNKNOWN', message });
    }
  }

  async function handleDelete() {
    if (modal.type !== 'delete') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteJobSearchGroup(modal.group.id);
      closeModal();
      await loadGroups();
    } catch (err) {
      const { message } = toUserFacingError(err, '삭제에 실패했습니다.');
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  const isFormOpen = modal.type === 'create' || modal.type === 'edit';
  const isEditMode = modal.type === 'edit';

  return (
    <div
      {...stylex.props([styles.jobSearchGroupsPageStack, motion.fadeIn])}
      data-stack=""
    >
      {/* Page header */}
      <div {...stylex.props(styles.jobSearchGroupsPageRow)}>
        <div>
          <p {...stylex.props(styles.jobSearchGroupsPageDescription)}>
            Job Search
          </p>
          <h1 {...stylex.props(styles.jobSearchGroupsPageHeading)}>
            구직 활동
          </h1>
          <p {...stylex.props(styles.jobSearchGroupsPageDescription2)}>
            구직 라운드별로 채용공고를 관리합니다
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusCircle {...stylex.props(styles.jobSearchGroupsPagePlusCircle)} />
          새 구직 활동
        </Button>
      </div>

      {/* Error state */}
      {!isLoading && error && (
        <Alert
          icon={
            <AlertCircle
              {...stylex.props(styles.jobSearchGroupsPagePlusCircle)}
            />
          }
          variant="destructive"
        >
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>
            <span {...stylex.props(styles.jobSearchGroupsPageText)}>
              {error.message}
            </span>
            <Button
              xstyle={styles.jobSearchGroupsPageButton}
              size="sm"
              variant="outline"
              onClick={() => loadGroups()}
            >
              <RefreshCw {...stylex.props(styles.groupCardBriefcase)} />
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div {...stylex.props(styles.jobSearchGroupsPageStack2)} data-stack="">
          {SKELETON_KEYS.map((key) => (
            <GroupCardSkeleton key={key} />
          ))}
        </div>
      )}

      {/* Active groups */}
      {!isLoading && !error && (
        <section
          {...stylex.props(styles.jobSearchGroupsPageStack2)}
          data-stack=""
        >
          <h2 {...stylex.props(styles.jobSearchGroupsPageHeading2)}>
            진행 중인 구직 활동
          </h2>
          {activeGroups.length === 0 ? (
            <Card xstyle={styles.jobSearchGroupsPageCard}>
              <CardContent xstyle={styles.jobSearchGroupsPageCardContent}>
                <div {...stylex.props(styles.jobSearchGroupsPageRow2)}>
                  <FolderOpen
                    {...stylex.props(styles.jobSearchGroupsPageFolderOpen)}
                  />
                </div>
                <div>
                  <p {...stylex.props(styles.jobSearchGroupsPageDescription3)}>
                    진행 중인 구직 활동이 없습니다
                  </p>
                  <p {...stylex.props(styles.jobSearchGroupsPageDescription2)}>
                    새 구직 활동을 만들어 채용공고를 저장해보세요
                  </p>
                </div>
                <Button onClick={openCreateModal}>
                  <PlusCircle
                    {...stylex.props(styles.jobSearchGroupsPagePlusCircle)}
                  />
                  새 구직 활동
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div {...stylex.props(styles.jobSearchGroupsPageGrid)}>
              {activeGroups.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isCurrent={index === 0}
                  isEnded={false}
                  endingId={endingGroupId}
                  onViewPostings={() =>
                    navigate(`/job-postings?group=${group.id}`)
                  }
                  onEdit={() => openEditModal(group)}
                  onEnd={() => setEndingGroupId(group.id)}
                  onConfirmEnd={() => handleEndGroup(group.id)}
                  onCancelEnd={() => setEndingGroupId(null)}
                  onDelete={() => openDeleteModal(group)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Ended groups — only shown when there are some */}
      {!isLoading && !error && endedGroups.length > 0 && (
        <section
          {...stylex.props(styles.jobSearchGroupsPageStack2)}
          data-stack=""
        >
          <h2 {...stylex.props(styles.jobSearchGroupsPageHeading3)}>
            지난 구직 활동
          </h2>
          <div {...stylex.props(styles.jobSearchGroupsPageGrid)}>
            {endedGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isCurrent={false}
                isEnded={true}
                endingId={null}
                onViewPostings={() =>
                  navigate(`/job-postings?group=${group.id}`)
                }
                onEdit={() => openEditModal(group)}
                onDelete={() => openDeleteModal(group)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Create / Edit Modal */}
      <Dialog
        opened={isFormOpen}
        onClose={closeModal}
        title={isEditMode ? '구직 활동 수정' : '새 구직 활동'}
      >
        <form
          {...stylex.props(styles.jobSearchGroupsPageStack2)}
          data-stack=""
          noValidate
          onSubmit={handleFormSubmit}
        >
          <div
            {...stylex.props(styles.jobSearchGroupsPageStack3)}
            data-stack=""
          >
            <Label htmlFor={GROUP_NAME_INPUT_ID}>이름</Label>
            <Input
              aria-describedby={
                formError?.type === 'name' ? GROUP_NAME_ERROR_ID : undefined
              }
              data-autofocus
              error={formError?.type === 'name'}
              id={GROUP_NAME_INPUT_ID}
              placeholder="예: 2026년 상반기 취업"
              required
              value={formName}
              onChange={(event) => {
                setFormName(event.currentTarget.value);
                if (formError?.type === 'name') setFormError(null);
              }}
            />
            {formError?.type === 'name' && (
              <p
                {...stylex.props(styles.jobSearchGroupsPageDescription4)}
                id={GROUP_NAME_ERROR_ID}
              >
                {formError.message}
              </p>
            )}
          </div>
          <div
            {...stylex.props(styles.jobSearchGroupsPageStack3)}
            data-stack=""
          >
            <Label htmlFor={GROUP_STARTED_AT_INPUT_ID}>시작일</Label>
            <Input
              id={GROUP_STARTED_AT_INPUT_ID}
              type="date"
              value={formStartedAt}
              onChange={(event) => setFormStartedAt(event.currentTarget.value)}
            />
          </div>
          <div
            {...stylex.props(styles.jobSearchGroupsPageStack3)}
            data-stack=""
          >
            <Label htmlFor={GROUP_ENDED_AT_INPUT_ID}>종료일</Label>
            <p
              {...stylex.props(styles.jobSearchGroupsPageDescription5)}
              id={GROUP_ENDED_AT_DESCRIPTION_ID}
            >
              비워두면 진행 중으로 유지됩니다
            </p>
            <Input
              aria-describedby={GROUP_ENDED_AT_DESCRIPTION_ID}
              id={GROUP_ENDED_AT_INPUT_ID}
              type="date"
              value={formEndedAt}
              onChange={(event) => setFormEndedAt(event.currentTarget.value)}
            />
          </div>
          <div
            {...stylex.props(styles.jobSearchGroupsPageStack3)}
            data-stack=""
          >
            <Label htmlFor={GROUP_MEMO_INPUT_ID}>메모</Label>
            <Textarea
              id={GROUP_MEMO_INPUT_ID}
              placeholder="이번 구직 활동에 대한 메모 (선택)"
              rows={3}
              value={formMemo}
              onChange={(event) => setFormMemo(event.currentTarget.value)}
            />
          </div>
          {formError?.type === 'submit' && (
            <Alert
              icon={
                <AlertCircle
                  {...stylex.props(styles.jobSearchGroupsPagePlusCircle)}
                />
              }
              variant="destructive"
            >
              <AlertTitle>저장 오류</AlertTitle>
              <AlertDescription>{formError.message}</AlertDescription>
            </Alert>
          )}
          <div {...stylex.props(styles.jobSearchGroupsPageRow3)}>
            <Button type="button" variant="outline" onClick={closeModal}>
              취소
            </Button>
            <Button loading={isSaving} type="submit">
              저장
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        opened={modal.type === 'delete'}
        onClose={closeModal}
        title="구직 활동 삭제"
      >
        {modal.type === 'delete' && (
          <div
            {...stylex.props(styles.jobSearchGroupsPageStack2)}
            data-stack=""
          >
            <div {...stylex.props(styles.jobSearchGroupsPageContainer)}>
              <p {...stylex.props(styles.jobSearchGroupsPageDescription6)}>
                {modal.group.name}
              </p>
              <p {...stylex.props(styles.jobSearchGroupsPageDescription7)}>
                저장된 채용공고 {modal.group.posting_count}개가 함께 삭제됩니다.
              </p>
              <p {...stylex.props(styles.jobSearchGroupsPageDescription8)}>
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            {deleteError && (
              <Alert
                icon={
                  <AlertCircle
                    {...stylex.props(styles.jobSearchGroupsPagePlusCircle)}
                  />
                }
                variant="destructive"
              >
                <AlertTitle>삭제 오류</AlertTitle>
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
            <div {...stylex.props(styles.jobSearchGroupsPageRow4)}>
              <Button variant="outline" onClick={closeModal}>
                취소
              </Button>
              <Button
                variant="destructive"
                loading={isDeleting}
                onClick={handleDelete}
              >
                <Trash2
                  {...stylex.props(styles.jobSearchGroupsPagePlusCircle)}
                />
                삭제
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const styles = stylex.create({
  groupCardSkeletonCard: {
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
    '--stack-space': '0.75rem',
  },
  groupCardSkeletonSkeleton: {
    height: '1.25rem',
    width: '50%',
  },
  groupCardSkeletonSkeleton2: {
    height: '1rem',
    width: '33.333333333333336%',
  },
  groupCardSkeletonRow: {
    display: 'flex',
    gap: '0.5rem',
    paddingTop: '0.25rem',
  },
  groupCardSkeletonSkeleton3: {
    height: '2rem',
    width: '5rem',
  },
  groupCardSkeletonSkeleton4: {
    height: '2rem',
    width: '4rem',
  },
  groupCardCard: {
    opacity: {
      default: 0.7,
      ':hover': 0.9,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  groupCardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  groupCardRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  groupCardHeading: {
    fontSize: '1rem',
    lineHeight: 1.25,
    fontWeight: 700,
  },
  groupCardBadge: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    flexShrink: 0,
  },
  groupCardRow3: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(55.1% .027 264.364)',
  },
  groupCardCalendar: {
    height: '0.875rem',
    width: '0.875rem',
    flexShrink: 0,
  },
  groupCardDescription: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  },
  groupCardRow4: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingTop: '0.25rem',
  },
  groupCardText: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(37.3% .034 259.733)',
  },
  groupCardRow5: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    paddingTop: '0.25rem',
  },
  groupCardBriefcase: {
    height: '0.875rem',
    width: '0.875rem',
  },
  groupCardButton: {
    color: {
      default: 'oklch(63.7% .237 25.331)',
      ':hover': 'oklch(57.7% .245 27.325)',
    },
    backgroundColor: {
      default: null,
      ':hover': 'color-mix(in oklab, oklch(63.7% .237 25.331) 8%, transparent)',
    },
  },
  jobSearchGroupsPageStack: {
    '--stack-space': '2rem',
  },
  jobSearchGroupsPageRow: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: '1rem',
    alignItems: {
      default: null,
      '@media (min-width: 40rem)': 'flex-end',
    },
    justifyContent: {
      default: null,
      '@media (min-width: 40rem)': 'space-between',
    },
  },
  jobSearchGroupsPageDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  jobSearchGroupsPageHeading: {
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 40rem)': '1.875rem',
    },
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  jobSearchGroupsPageDescription2: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobSearchGroupsPagePlusCircle: {
    height: '1rem',
    width: '1rem',
  },
  jobSearchGroupsPageText: {
    display: 'block',
  },
  jobSearchGroupsPageButton: {
    marginTop: '0.75rem',
  },
  jobSearchGroupsPageStack2: {
    '--stack-space': '1rem',
  },
  jobSearchGroupsPageHeading2: {
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
  },
  jobSearchGroupsPageCard: {
    paddingTop: '3rem',
    paddingBottom: '3rem',
    textAlign: 'center',
  },
  jobSearchGroupsPageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '0rem',
    paddingBottom: '0rem',
  },
  jobSearchGroupsPageRow2: {
    display: 'flex',
    height: '3.5rem',
    width: '3.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '1rem',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 10%, transparent)',
    color: 'hsl(var(--primary))',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  jobSearchGroupsPageFolderOpen: {
    height: '1.5rem',
    width: '1.5rem',
  },
  jobSearchGroupsPageDescription3: {
    fontWeight: 600,
  },
  jobSearchGroupsPageGrid: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 64rem)': 'repeat(3, minmax(0, 1fr))',
    },
  },
  jobSearchGroupsPageHeading3: {
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
    color: 'oklch(44.6% .03 256.802)',
  },
  jobSearchGroupsPageStack3: {
    '--stack-space': '0.375rem',
  },
  jobSearchGroupsPageDescription4: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(63.7% .237 25.331)',
  },
  jobSearchGroupsPageDescription5: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'hsl(var(--muted-foreground))',
  },
  jobSearchGroupsPageRow3: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    paddingTop: '0.5rem',
  },
  jobSearchGroupsPageContainer: {
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 20%, transparent)',
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 8%, transparent)',
    paddingTop: '1rem',
    paddingRight: '1rem',
    paddingBottom: '1rem',
    paddingLeft: '1rem',
  },
  jobSearchGroupsPageDescription6: {
    fontWeight: 600,
    color: 'oklch(50.5% .213 27.518)',
  },
  jobSearchGroupsPageDescription7: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(57.7% .245 27.325)',
  },
  jobSearchGroupsPageDescription8: {
    marginTop: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(63.7% .237 25.331)',
  },
  jobSearchGroupsPageRow4: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
});
