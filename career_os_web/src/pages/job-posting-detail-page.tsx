import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Code2,
  DollarSign,
  ExternalLink,
  FileText,
  Gift,
  Globe,
  Info,
  List,
  MapPin,
  RefreshCw,
  Star,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { fetchJobPosting } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import type { JobPostingDetail } from '../types/job-posting';
import {
  formatRelativeDate,
  platformVariant,
} from '../utils/job-posting-formatters';
import { toSafeExternalUrl } from '../utils/url';

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-accent border px-3 py-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  );
}

function DetailErrorState({
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

export function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const [detail, setDetail] = useState<JobPostingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const loadDetail = useCallback(
    (signal?: AbortSignal) => {
      if (!token || !id) return;

      setIsLoading(true);
      setError(null);

      fetchJobPosting(token, Number(id), signal)
        .then(setDetail)
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(toUserFacingError(err, '데이터를 불러오지 못했습니다.'));
        })
        .finally(() => {
          if (!signal?.aborted) setIsLoading(false);
        });
    },
    [token, id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail]);

  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/job-postings">
        <ArrowLeft className="h-4 w-4" />
        채용공고 목록
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        {backLink}
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in space-y-6">
        {backLink}
        <DetailErrorState error={error} onRetry={loadDetail} />
      </div>
    );
  }

  if (!detail) return null;

  const safePostingUrl = toSafeExternalUrl(detail.posting_url);
  const safeHomepage = toSafeExternalUrl(detail.homepage);

  const hasMetadata = Boolean(
    detail.location ||
      detail.experience_req ||
      detail.employment_type ||
      detail.deadline ||
      detail.salary,
  );

  const textSections: Array<{
    title: string;
    icon: ComponentType<{ className?: string }>;
    content: string | null;
  }> = [
    { title: '직무 소개', icon: FileText, content: detail.job_description },
    { title: '주요 업무', icon: List, content: detail.responsibilities },
    { title: '자격 요건', icon: CheckCircle, content: detail.qualifications },
    { title: '우대 사항', icon: Star, content: detail.preferred_points },
    { title: '복리후생', icon: Gift, content: detail.benefits },
    { title: '채용 프로세스', icon: Briefcase, content: detail.hiring_process },
  ];

  const additionalFields = [
    { label: '학력', value: detail.education_req },
    { label: '지원 방법', value: detail.application_method },
    { label: '지원 서류', value: detail.application_form },
    { label: '담당자', value: detail.contact_person },
    { label: '직종', value: detail.job_category },
    { label: '산업', value: detail.industry },
  ].filter((f) => f.value);

  return (
    <div className="animate-fade-in space-y-6">
      {backLink}

      {/* Page header */}
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
          Job Detail
        </p>
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 shrink-0 text-gray-600" />
          <span className="text-sm font-medium text-gray-600">
            {detail.company_name}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {detail.job_title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={platformVariant(detail.platform)}>
            {detail.platform}
          </Badge>
          <span className="text-sm text-gray-500">
            {formatRelativeDate(detail.created_at)}
          </span>
          {safePostingUrl && (
            <Button className="sm:ml-2" variant="outline" size="sm" asChild>
              <a href={safePostingUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4" />
                원본 공고 보기
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      {hasMetadata && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {detail.location && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="h-4 w-4 text-primary" />
                  {detail.location}
                </span>
              )}
              {detail.experience_req && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Briefcase className="h-4 w-4 text-primary" />
                  {detail.experience_req}
                </span>
              )}
              {detail.employment_type && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Clock className="h-4 w-4 text-primary" />
                  {detail.employment_type}
                </span>
              )}
              {detail.deadline && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <Calendar className="h-4 w-4" />
                  마감: {detail.deadline}
                </span>
              )}
              {detail.salary && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {detail.salary}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tech stack */}
      {detail.tech_stack && detail.tech_stack.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionHeading icon={Code2} title="기술 스택" />
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.tech_stack.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text sections */}
      {textSections
        .filter((s) => s.content)
        .map(({ title, icon, content }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <SectionHeading icon={icon} title={title} />
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                {content}
              </p>
            </CardContent>
          </Card>
        ))}

      {/* Additional info */}
      {additionalFields.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionHeading icon={Info} title="추가 정보" />
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {additionalFields.map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-muted p-3"
                >
                  <dt className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Homepage */}
      {safeHomepage && (
        <Card>
          <CardContent className="p-5">
            <SectionHeading icon={Globe} title="홈페이지" />
            <a
              className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
              href={safeHomepage}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {detail.homepage}
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
