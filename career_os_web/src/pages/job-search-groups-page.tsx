import { Modal, Textarea, TextInput } from '@mantine/core';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  FolderOpen,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';
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

function GroupCardSkeleton() {
  return (
    <Card className="p-5 space-y-3">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
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
    <Card
      className={
        isEnded ? 'opacity-70 transition-opacity hover:opacity-90' : undefined
      }
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold leading-snug">
              {group.name}
            </h3>
            {isCurrent && (
              <Badge variant="default" className="text-xs shrink-0">
                현재
              </Badge>
            )}
            {isEnded && (
              <Badge variant="outline" className="text-xs shrink-0">
                종료
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {group.posting_count}개 공고
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {formatDate(group.started_at)} ~{' '}
            {group.ended_at ? formatDate(group.ended_at) : '진행 중'}
          </span>
        </div>

        {group.memo && (
          <p className="text-sm text-gray-600 line-clamp-2">{group.memo}</p>
        )}

        {isConfirmingEnd ? (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-gray-700">종료하시겠습니까?</span>
            <Button size="sm" variant="destructive" onClick={onConfirmEnd}>
              확인
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEnd}>
              취소
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onViewPostings}>
              <Briefcase className="h-3.5 w-3.5" />
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
              className="text-red-500 hover:text-red-600 hover:bg-red-500/8"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
  const [formError, setFormError] = useState<string | null>(null);
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

  async function handleFormSubmit() {
    if (!formName.trim()) {
      setFormError('그룹 이름을 입력해주세요.');
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
      setFormError(message);
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
    <div className="animate-fade-in space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            Job Search
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            구직 활동
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            구직 라운드별로 채용공고를 관리합니다
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusCircle className="h-4 w-4" />새 구직 활동
        </Button>
      </div>

      {/* Error state */}
      {!isLoading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>
            <span className="block">{error.message}</span>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => loadGroups()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {SKELETON_KEYS.map((key) => (
            <GroupCardSkeleton key={key} />
          ))}
        </div>
      )}

      {/* Active groups */}
      {!isLoading && !error && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">진행 중인 구직 활동</h2>
          {activeGroups.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">
                    진행 중인 구직 활동이 없습니다
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    새 구직 활동을 만들어 채용공고를 저장해보세요
                  </p>
                </div>
                <Button onClick={openCreateModal}>
                  <PlusCircle className="h-4 w-4" />새 구직 활동
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-600">
            지난 구직 활동
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <Modal
        opened={isFormOpen}
        onClose={closeModal}
        title={isEditMode ? '구직 활동 수정' : '새 구직 활동'}
        centered
      >
        <div className="space-y-4">
          <TextInput
            label="이름"
            placeholder="예: 2026년 상반기 취업"
            required
            value={formName}
            onChange={(e) => setFormName(e.currentTarget.value)}
          />
          <TextInput
            label="시작일"
            type="date"
            value={formStartedAt}
            onChange={(e) => setFormStartedAt(e.currentTarget.value)}
          />
          <TextInput
            label="종료일"
            type="date"
            value={formEndedAt}
            onChange={(e) => setFormEndedAt(e.currentTarget.value)}
            description="비워두면 진행 중으로 유지됩니다"
          />
          <Textarea
            label="메모"
            placeholder="이번 구직 활동에 대한 메모 (선택)"
            rows={3}
            value={formMemo}
            onChange={(e) => setFormMemo(e.currentTarget.value)}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal}>
              취소
            </Button>
            <Button loading={isSaving} onClick={handleFormSubmit}>
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={modal.type === 'delete'}
        onClose={closeModal}
        title="구직 활동 삭제"
        centered
      >
        {modal.type === 'delete' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4">
              <p className="font-semibold text-red-700">{modal.group.name}</p>
              <p className="mt-1 text-sm text-red-600">
                저장된 채용공고 {modal.group.posting_count}개가 함께 삭제됩니다.
              </p>
              <p className="mt-2 text-xs font-semibold text-red-500">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeModal}>
                취소
              </Button>
              <Button
                variant="destructive"
                loading={isDeleting}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
