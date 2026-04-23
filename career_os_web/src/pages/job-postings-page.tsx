import {
  AlertCircle,
  Briefcase,
  Building2,
  ExternalLink,
  MapPin,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { fetchJobPostings } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import type { JobPostingListItem, Platform } from '../types/job-posting';

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

function platformVariant(platform: Platform) {
  return platform === 'saramin' ? 'saramin' : 'wanted';
}

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

  return (
    <Card className="group overflow-hidden" interactive>
      <CardContent className="relative p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Badge variant={platformVariant(item.platform)}>
            {item.platform}
          </Badge>
          <span className="text-xs font-medium text-gray-600">
            {formatRelativeDate(item.created_at)}
          </span>
        </div>

        <div className="mb-1.5 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-gray-600 shrink-0" />
          <span className="text-sm font-medium text-gray-600 truncate">
            {item.company_name}
          </span>
        </div>

        <a
          className="flex items-start gap-2"
          href={item.posting_url}
          rel="noreferrer"
          target="_blank"
        >
          <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
            {item.job_title}
          </h3>
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-primary/60 transition-transform group-hover:translate-x-0.5" />
        </a>

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
      <Button className="mt-6" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        다시 시도
      </Button>
    </div>
  );
}

export function JobPostingsPage() {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const loadJobPostings = useCallback(() => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    fetchJobPostings(token)
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err: unknown) => {
        setError(toUserFacingError(err, '데이터를 불러오지 못했습니다.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  useEffect(() => {
    loadJobPostings();
  }, [loadJobPostings]);

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
            <Link to="/job-postings/new">
              <PlusCircle className="h-4 w-4" />새 채용공고 등록
            </Link>
          </Button>
        </div>
      </div>

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
              <Link to="/job-postings/new">
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
    </div>
  );
}
