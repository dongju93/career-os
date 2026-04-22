import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchJobPostings } from '@/services/job-postings';
import { useAuthStore } from '@/store/auth-store';
import type { JobPostingListItem } from '@/types/job-posting';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORM_LABELS: Record<string, string> = {
  saramin: '사람인',
  wanted: '원티드',
};

function JobPostingCard({ item }: { item: JobPostingListItem }) {
  const platformLabel = PLATFORM_LABELS[item.platform] ?? item.platform;
  const addedAt = new Date(item.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant={item.platform === 'saramin' ? 'saramin' : 'wanted'}
              className="shrink-0"
            >
              {platformLabel}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {addedAt}
            </span>
          </div>

          {/* Company & Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {item.company_name}
            </div>
            <a
              href={item.posting_url}
              rel="noopener noreferrer"
              target="_blank"
              className="group/link flex items-start gap-2 font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span className="line-clamp-2">{item.job_title}</span>
              <ExternalLink className="h-4 w-4 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

          {/* Deadline & Salary */}
          <div className="flex items-center justify-between text-sm">
            <span
              className={cn(
                'flex items-center gap-1 font-medium',
                item.deadline ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {item.deadline ? `마감 ${item.deadline}` : '마감일 미정'}
            </span>
            {item.salary && (
              <span className="text-muted-foreground">{item.salary}</span>
            )}
          </div>

          {/* Tech Stack */}
          {item.tech_stack && item.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {item.tech_stack.slice(0, 5).map((tech) => (
                <Badge key={tech} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {item.tech_stack.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tech_stack.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-full" />
            </div>
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="glass-card">
      <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/10 mb-6">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">저장된 채용공고가 없습니다</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          관심 있는 채용공고 URL을 등록하면 여기에서 한눈에 관리할 수 있습니다.
        </p>
        <Button asChild>
          <Link to="/job-postings/new">
            <Plus className="h-4 w-4 mr-2" />
            첫 채용공고 등록하기
          </Link>
        </Button>
      </CardContent>
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            저장한 채용공고
          </h1>
          {!isLoading && !error && (
            <p className="text-muted-foreground mt-1">
              총 {total}개의 채용공고가 저장되어 있습니다.
            </p>
          )}
        </div>
        <Button asChild className="shrink-0">
          <Link to="/job-postings/new">
            <Plus className="h-4 w-4 mr-2" />
            새 채용공고 등록
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading && <LoadingSkeleton />}

      {!isLoading && error && (
        <Alert variant="destructive">
          <AlertTitle>불러오기 실패</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && items.length === 0 && <EmptyState />}

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
