import {
  AlertCircle,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  MapPin,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { cn } from '@/lib/utils';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { fetchJobPostings } from '../services/job-postings';
import { fetchJobSearchGroups } from '../services/job-search-groups';
import type { JobPostingListItem } from '../types/job-posting';
import type { JobSearchGroupItem } from '../types/job-search-group';
import {
  APPLICATION_STATUS_LABELS,
  applicationStatusAccentClass,
  applicationStatusVariant,
  formatRelativeDate,
  platformVariant,
} from '../utils/job-posting-formatters';
import { toSafeExternalUrl } from '../utils/url';

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-xl border-white/12 bg-accent px-4 py-2.5 backdrop-blur-md">
      <p className="text-[11px] font-medium tracking-wide text-gray-600 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function JobPostingCard({ item }: { item: JobPostingListItem }) {
  const hasDetails = Boolean(
    item.location || item.experience_req || item.deadline || item.salary,
  );
  const safePostingUrl = toSafeExternalUrl(item.posting_url);

  return (
    <Card className="group glass-hover relative overflow-hidden has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          applicationStatusAccentClass(item.application_status),
        )}
      />
      <CardContent className="p-5 pl-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={platformVariant(item.platform)}>
              {item.platform}
            </Badge>
            <Badge variant={applicationStatusVariant(item.application_status)}>
              {APPLICATION_STATUS_LABELS[item.application_status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              {formatRelativeDate(item.created_at)}
            </span>
            {safePostingUrl && (
              <a
                className="relative z-10 flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-accent hover:text-primary"
                href={safePostingUrl}
                rel="noreferrer"
                target="_blank"
                title="원본 공고 열기"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="sr-only">원본 공고 열기</span>
              </a>
            )}
          </div>
        </div>

        <div className="mb-1.5 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-gray-600 shrink-0" />
          <span className="text-sm font-medium text-gray-600 truncate">
            {item.company_name}
          </span>
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
          <Link
            to={`/job-postings/${item.id}`}
            className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
          >
            {item.job_title}
          </Link>
        </h3>

        {hasDetails && (
          <div className="mt-3 rounded-xl border border-white/8 bg-muted p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
              {item.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </span>
              )}
              {item.experience_req && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {item.experience_req}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {item.deadline && (
                <span className="inline-flex items-center rounded-full bg-red-500/8 px-2.5 py-0.5 text-xs font-medium text-red-600 border border-red-500/15">
                  마감: {item.deadline}
                </span>
              )}
              {item.salary && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-gray-600 border">
                  {item.salary}
                </span>
              )}
            </div>
          </div>
        )}

        {item.tech_stack && item.tech_stack.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tech_stack.slice(0, 5).map((tag) => (
              <Badge key={tag} className="text-xs" variant="secondary">
                {tag}
              </Badge>
            ))}
            {item.tech_stack.length > 5 && (
              <Badge className="text-xs" variant="outline">
                +{item.tech_stack.length - 5}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 50;

const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f'];

function LoadingCard() {
  return (
    <Card className="space-y-3 p-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
      </div>
    </Card>
  );
}

function JobPostingsErrorState({
  error,
  onRetry,
}: {
  error: UserFacingError;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-[22rem] rounded-xl border border-red-500/20 bg-red-500/8 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight">
        채용공고를 불러오지 못했습니다
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
        {error.message}
      </p>
      <p className="mt-3 font-mono text-xs font-semibold text-red-500">
        {error.code}
      </p>
      <Button className="mt-6" variant="outline" onClick={() => onRetry()}>
        <RefreshCw className="h-4 w-4" />
        다시 시도
      </Button>
    </div>
  );
}

function GroupFilterBar({
  groups,
  selected,
  onSelect,
}: {
  groups: JobSearchGroupItem[];
  selected: string | 'all';
  onSelect: (value: string | 'all') => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors border',
          selected === 'all'
            ? 'bg-primary/15 text-primary border-primary/20'
            : 'text-gray-600 border-transparent hover:bg-muted',
        )}
        onClick={() => onSelect('all')}
      >
        <Layers className="h-3.5 w-3.5" />
        모든 공고
      </button>
      {groups.map((group, index) => (
        <button
          key={group.id}
          type="button"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors border',
            selected === group.id
              ? 'bg-primary/15 text-primary border-primary/20'
              : 'text-gray-600 border-transparent hover:bg-muted',
          )}
          onClick={() => onSelect(group.id)}
        >
          {index === 0 ? `${group.name} (현재)` : group.name}
          {group.posting_count > 0 && (
            <span
              className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                selected === group.id
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-gray-500',
              )}
            >
              {group.posting_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function JobPostingsPage() {
  useDocumentTitle('채용공고');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const groupParam = searchParams.get('group');

  const [activeGroups, setActiveGroups] = useState<JobSearchGroupItem[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Derive selected group: param takes precedence; default to first active group
  const selectedGroup: string | 'all' =
    groupParam === 'all'
      ? 'all'
      : (groupParam ??
        (groupsLoaded && activeGroups.length > 0 ? activeGroups[0].id : 'all'));

  const [items, setItems] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  // Load active groups for the filter bar
  useEffect(() => {
    const controller = new AbortController();
    fetchJobSearchGroups({ status: 'active', limit: 50 }, controller.signal)
      .then((data) => {
        setActiveGroups(data.items);
        setGroupsLoaded(true);
      })
      .catch(() => {
        // Non-critical: filter bar gracefully degrades
        setGroupsLoaded(true);
      });
    return () => controller.abort();
  }, []);

  // When groups finish loading and there's no explicit group param, set default
  useEffect(() => {
    if (groupsLoaded && activeGroups.length > 0 && groupParam === null) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('group', activeGroups[0].id);
          return next;
        },
        { replace: true },
      );
    }
  }, [groupsLoaded, activeGroups, groupParam, setSearchParams]);

  const groupId = selectedGroup === 'all' ? undefined : selectedGroup;

  const loadJobPostings = useCallback(
    (signal?: AbortSignal) => {
      const offset = (page - 1) * PAGE_SIZE;
      setIsLoading(true);
      setError(null);

      fetchJobPostings(offset, PAGE_SIZE, groupId, signal)
        .then((pageData) => {
          setItems(pageData.items);
          setTotal(pageData.total);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(toUserFacingError(err, '데이터를 불러오지 못했습니다.'));
        })
        .finally(() => {
          if (!signal?.aborted) setIsLoading(false);
        });
    },
    [page, groupId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadJobPostings(controller.signal);
    return () => controller.abort();
  }, [loadJobPostings]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function goToPage(newPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectGroup(value: string | 'all') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('group', value);
      next.delete('page');
      return next;
    });
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header — transparent, floating on background */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            Job Archive
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            채용공고
          </h1>
          {!isLoading && !error && total > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              총 {total}개의 채용공고
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SummaryChip
            label="저장된 공고"
            value={isLoading ? '-' : total.toString()}
          />
          <SummaryChip
            label="최근 등록"
            value={
              !isLoading && items.length > 0
                ? formatRelativeDate(items[0].created_at)
                : '-'
            }
          />
          <Button asChild className="sm:self-stretch">
            <Link
              to={
                selectedGroup !== 'all'
                  ? `/job-postings/new?group=${selectedGroup}`
                  : '/job-postings/new'
              }
            >
              <PlusCircle className="h-4 w-4" />새 채용공고 등록
            </Link>
          </Button>
        </div>
      </div>

      {/* Group filter bar */}
      {groupsLoaded && (
        <GroupFilterBar
          groups={activeGroups}
          selected={selectedGroup}
          onSelect={selectGroup}
        />
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <LoadingCard key={key} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <JobPostingsErrorState error={error} onRetry={loadJobPostings} />
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            className="col-span-full flex flex-col items-center gap-4 py-16 text-center"
            glass
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                아직 저장된 채용공고가 없어요
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                첫 번째 채용공고를 등록해 보세요
              </p>
            </div>
            <Button asChild>
              <Link
                to={
                  selectedGroup !== 'all'
                    ? `/job-postings/new?group=${selectedGroup}`
                    : '/job-postings/new'
                }
              >
                <PlusCircle className="h-4 w-4" />
                채용공고 등록하기
              </Link>
            </Button>
          </Card>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <JobPostingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            disabled={!hasPrev}
            size="sm"
            variant="outline"
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            disabled={!hasNext}
            size="sm"
            variant="outline"
            onClick={() => goToPage(page + 1)}
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
