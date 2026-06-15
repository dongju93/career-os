import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Code2,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Gift,
  Globe,
  Info,
  List,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  StickyNote,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ApiError,
  toUserFacingError,
  type UserFacingError,
} from '../services/api-error';
import { fetchJobPosting, updateJobPosting } from '../services/job-postings';
import { generateArtifact } from '../services/strategist';
import type {
  ApplicationArtifact,
  ArtifactType,
} from '../types/application-artifact';
import type { ApplicationStatus, JobPostingDetail } from '../types/job-posting';
import {
  APPLICATION_STATUS_LABELS,
  applicationStatusVariant,
  formatRelativeDate,
  platformVariant,
} from '../utils/job-posting-formatters';
import { ARTIFACT_TYPE_LABELS } from '../utils/strategist-formatters';

const APPLICATION_STATUS_OPTIONS = Object.keys(
  APPLICATION_STATUS_LABELS,
) as ApplicationStatus[];

// §3 memo cap, enforced client-side so the server 422 stays a fallback.
const MEMO_MAX = 2000;

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
      <Button className="mt-6" variant="outline" onClick={() => onRetry()}>
        <RefreshCw className="h-4 w-4" />
        다시 시도
      </Button>
    </div>
  );
}

const ARTIFACT_TYPE_OPTIONS = Object.keys(
  ARTIFACT_TYPE_LABELS,
) as ArtifactType[];

// §7 focus cap, enforced client-side so the server 422 stays a fallback.
const ARTIFACT_FOCUS_MAX = 300;

// Per-posting "AI 지원 자료" generator. Mirrors the strategist page's long-latency
// treatment and the §8 no-retry/abort contract: the POST is single-attempt, the
// in-flight ~10–60 s run is aborted on unmount, and errors never auto-retry.
function JobPostingArtifactCard({ jobId }: { jobId: number }) {
  const [artifactType, setArtifactType] =
    useState<ArtifactType>('resume_bullets');
  const [focusText, setFocusText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [artifact, setArtifact] = useState<ApplicationArtifact | null>(null);
  const [artifactError, setArtifactError] = useState<{
    message: string;
    canRetry: boolean;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const artifactControllerRef = useRef<AbortController | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort the in-flight run and drop the pending copy-reset timer on unmount.
  useEffect(() => {
    return () => {
      artifactControllerRef.current?.abort();
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  async function handleGenerate() {
    artifactControllerRef.current?.abort();
    const controller = new AbortController();
    artifactControllerRef.current = controller;

    setIsGenerating(true);
    setArtifactError(null);
    setArtifact(null);
    setIsCopied(false);

    try {
      const result = await generateArtifact(
        {
          job_id: jobId,
          artifact_type: artifactType,
          focus: focusText.trim() === '' ? null : focusText.trim(),
        },
        controller.signal,
      );
      setArtifact(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      // The posting is already loaded and owned, so a 404 here is the feature
      // flag being off (§3 shares it with the plan endpoint), not a missing
      // posting; 409 means no profile yet. Neither is retryable, and a 429
      // carries a useful message but retrying would just re-hit the limit.
      // Everything else (incl. 502 run failures) gets a manual retry.
      if (err instanceof ApiError && err.status === 404) {
        setArtifactError({
          message: '아직 준비 중인 기능이에요.',
          canRetry: false,
        });
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setArtifactError({
          message: 'AI 지원 자료를 생성하려면 먼저 프로필을 작성해주세요.',
          canRetry: false,
        });
        return;
      }
      const canRetry = !(err instanceof ApiError && err.status === 429);
      setArtifactError({
        message: toUserFacingError(err, 'AI 지원 자료를 생성하지 못했습니다.')
          .message,
        canRetry,
      });
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
      if (artifactControllerRef.current === controller) {
        artifactControllerRef.current = null;
      }
    }
  }

  async function handleCopy() {
    if (!artifact) return;
    try {
      await navigator.clipboard.writeText(artifact.content_markdown);
      setIsCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission).
      // The text stays on screen for manual selection; skip the copied feedback.
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <SectionHeading icon={Sparkles} title="AI 지원 자료" />
        <p className="mt-3 text-sm text-gray-600">
          저장한 공고와 프로필을 바탕으로 지원 자료 초안을 만들어드려요.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="artifact-type">자료 종류</Label>
            <select
              className="input-clean h-10 w-full rounded-xl px-3 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              disabled={isGenerating}
              id="artifact-type"
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
            >
              {ARTIFACT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {ARTIFACT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="artifact-focus">집중할 방향 (선택)</Label>
            <Input
              disabled={isGenerating}
              id="artifact-focus"
              maxLength={ARTIFACT_FOCUS_MAX}
              placeholder="예: 리더십 경험 강조"
              value={focusText}
              onChange={(e) => setFocusText(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? '생성 중…' : '자료 생성'}
          </Button>
          {isGenerating && (
            <span className="text-sm text-gray-600">
              자료를 생성하고 있어요. 최대 1분 정도 걸릴 수 있어요.
            </span>
          )}
        </div>

        {artifactError && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {artifactError.message}
              {artifactError.canRetry && (
                <Button
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                >
                  <RefreshCw className="h-4 w-4" />
                  다시 시도
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {artifact && (
          <div className="mt-4 rounded-xl border border-primary/15 bg-primary/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold tracking-tight">
                {artifact.title}
              </h3>
              <Button
                className="shrink-0"
                size="sm"
                variant="outline"
                onClick={handleCopy}
              >
                {isCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {isCopied ? '복사됨' : '복사하기'}
              </Button>
            </div>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {artifact.content_markdown}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<JobPostingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<UserFacingError | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [memoError, setMemoError] = useState<UserFacingError | null>(null);
  const [memoSuccess, setMemoSuccess] = useState(false);

  const loadDetail = useCallback(
    (signal?: AbortSignal) => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      fetchJobPosting(Number(id), signal)
        .then((loaded) => {
          setDetail(loaded);
          // Seed the editable draft from the server value; further edits are
          // local until the user saves.
          setMemoDraft(loaded.memo ?? '');
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(toUserFacingError(err, '데이터를 불러오지 못했습니다.'));
        })
        .finally(() => {
          if (!signal?.aborted) setIsLoading(false);
        });
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail]);

  async function handleStatusChange(next: ApplicationStatus) {
    if (!detail || next === detail.application_status) return;

    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      const updated = await updateJobPosting(detail.id, {
        application_status: next,
      });
      // Server response is the source of truth (no optimistic write).
      setDetail(updated);
    } catch (err) {
      setStatusError(toUserFacingError(err, '상태를 변경하지 못했습니다.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSaveMemo() {
    if (!detail) return;

    setIsSavingMemo(true);
    setMemoError(null);
    setMemoSuccess(false);

    try {
      // An empty draft is an explicit clear (memo: null per §3); otherwise save
      // the trimmed text, matching the profile page's free-text handling.
      const trimmed = memoDraft.trim();
      const updated = await updateJobPosting(detail.id, {
        memo: trimmed === '' ? null : trimmed,
      });
      // Server response is the source of truth (no optimistic write).
      setDetail(updated);
      setMemoDraft(updated.memo ?? '');
      setMemoSuccess(true);
    } catch (err) {
      setMemoError(toUserFacingError(err, '메모를 저장하지 못했습니다.'));
    } finally {
      setIsSavingMemo(false);
    }
  }

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

      {/* Application status */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SectionHeading icon={ClipboardList} title="지원 상태" />
            <Badge
              variant={applicationStatusVariant(detail.application_status)}
            >
              {APPLICATION_STATUS_LABELS[detail.application_status]}
            </Badge>
            <label className="sr-only" htmlFor="application-status">
              지원 상태 변경
            </label>
            <select
              className="input-clean h-10 rounded-xl px-3 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              disabled={isUpdatingStatus}
              id="application-status"
              value={detail.application_status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ApplicationStatus)
              }
            >
              {APPLICATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {detail.status_updated_at && (
              <span className="text-xs text-gray-500">
                {formatRelativeDate(detail.status_updated_at)} 업데이트
              </span>
            )}
          </div>
          {statusError && (
            <Alert className="mt-3" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{statusError.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Memo */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={StickyNote} title="메모" />
            <span className="text-xs text-gray-500">
              {memoDraft.length} / {MEMO_MAX}
            </span>
          </div>
          <Textarea
            aria-label="메모"
            className="mt-3"
            disabled={isSavingMemo}
            maxLength={MEMO_MAX}
            placeholder="이 공고에 대한 메모를 남겨보세요."
            value={memoDraft}
            onChange={(e) => {
              setMemoDraft(e.target.value);
              setMemoSuccess(false);
            }}
          />
          {memoError && (
            <Alert className="mt-3" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{memoError.message}</AlertDescription>
            </Alert>
          )}
          {memoSuccess && (
            <Alert className="mt-3" variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>메모를 저장했습니다.</AlertDescription>
            </Alert>
          )}
          <div className="mt-3 flex justify-end">
            <Button
              disabled={isSavingMemo || memoDraft === (detail.memo ?? '')}
              onClick={handleSaveMemo}
            >
              <Save className="h-4 w-4" />
              {isSavingMemo ? '저장 중…' : '메모 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI artifacts (Phase 3) */}
      <JobPostingArtifactCard jobId={detail.id} />

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
