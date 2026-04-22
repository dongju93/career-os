import {
  Briefcase,
  Building2,
  ExternalLink,
  MapPin,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

function JobPostingCard({ item }: { item: JobPostingListItem }) {
  return (
    <Card className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer">
      <CardContent className="p-5">
        {/* Platform + date */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant={platformVariant(item.platform)}>
            {item.platform}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(item.created_at)}
          </span>
        </div>

        {/* Company */}
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-muted-foreground truncate">
            {item.company_name}
          </span>
        </div>

        {/* Job title */}
        <a
          className="group flex items-start gap-1.5 mb-3"
          href={item.posting_url}
          rel="noreferrer"
          target="_blank"
        >
          <h3 className="text-base font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {item.job_title}
          </h3>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </a>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-muted-foreground">
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

        {/* Deadline + salary */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
          {item.deadline && (
            <span className="text-destructive font-medium">
              마감: {item.deadline}
            </span>
          )}
          {item.salary && (
            <span className="text-muted-foreground">{item.salary}</span>
          )}
        </div>

        {/* Tech stack */}
        {item.tech_stack && item.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tech_stack.slice(0, 5).map((tag) => (
              <Badge key={tag} className="text-xs" variant="outline">
                {tag}
              </Badge>
            ))}
            {item.tech_stack.length > 5 && (
              <Badge className="text-xs" variant="secondary">
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
    <Card className="p-6 space-y-3">
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
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            채용공고
          </h1>
          {!isLoading && !error && total > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              총 {total}개의 채용공고
            </p>
          )}
        </div>
        <Button asChild>
          <Link to="/job-postings/new">
            <PlusCircle className="h-4 w-4" />새 채용공고 등록
          </Link>
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <LoadingCard key={key} />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <Alert variant="destructive">
          <AlertTitle>불러오기 실패</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !error && items.length === 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full py-16 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-linear-to-br from-primary/20 to-teal-500/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                아직 저장된 채용공고가 없어요
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
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

      {/* Grid */}
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
