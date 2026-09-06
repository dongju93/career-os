import * as stylex from '@stylexjs/stylex';
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
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { surfaces } from '@/styles/surfaces';
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
    <div {...stylex.props(styles.sectionHeadingContainer)}>
      <Icon {...stylex.props(styles.sectionHeadingIcon)} />
      <span {...stylex.props(styles.sectionHeadingText)}>{title}</span>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div {...stylex.props(styles.detailLoadingSkeletonStack)} data-stack="">
      <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton} />
      <div {...stylex.props(styles.detailLoadingSkeletonStack2)} data-stack="">
        <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton2} />
        <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton3} />
        <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton4} />
        <div {...stylex.props(styles.detailLoadingSkeletonRow)}>
          <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton5} />
          <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton6} />
          <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton7} />
        </div>
      </div>
      <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton8} />
      <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton9} />
      <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton10} />
      <Skeleton xstyle={styles.detailLoadingSkeletonSkeleton10} />
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
    <div {...stylex.props(styles.detailErrorStateContainer)}>
      <div {...stylex.props(styles.detailErrorStateRow)}>
        <AlertCircle {...stylex.props(styles.detailErrorStateAlertCircle)} />
      </div>
      <h2 {...stylex.props(styles.detailErrorStateHeading)}>
        채용공고를 불러오지 못했습니다
      </h2>
      <p {...stylex.props(styles.detailErrorStateDescription)}>
        {error.message}
      </p>
      <p {...stylex.props(styles.detailErrorStateDescription2)}>{error.code}</p>
      <Button
        xstyle={styles.detailErrorStateButton}
        variant="outline"
        onClick={() => onRetry()}
      >
        <RefreshCw {...stylex.props(styles.detailErrorStateRefreshCw)} />
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
      <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
        <SectionHeading icon={Sparkles} title="AI 지원 자료" />
        <p {...stylex.props(styles.jobPostingArtifactCardDescription)}>
          저장한 공고와 프로필을 바탕으로 지원 자료 초안을 만들어드려요.
        </p>

        <div {...stylex.props(styles.jobPostingArtifactCardGrid)}>
          <div
            {...stylex.props(styles.jobPostingArtifactCardStack)}
            data-stack=""
          >
            <Label htmlFor="artifact-type">자료 종류</Label>
            <select
              {...stylex.props([
                styles.jobPostingArtifactCardSelect,
                surfaces.inputClean,
              ])}
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

          <div
            {...stylex.props(styles.jobPostingArtifactCardStack)}
            data-stack=""
          >
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

        <div {...stylex.props(styles.jobPostingArtifactCardRow)}>
          <Button disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? (
              <Loader2
                {...stylex.props([
                  styles.jobPostingArtifactCardLoader2,
                  motion.spin,
                ])}
              />
            ) : (
              <Sparkles {...stylex.props(styles.detailErrorStateRefreshCw)} />
            )}
            {isGenerating ? '생성 중…' : '자료 생성'}
          </Button>
          {isGenerating && (
            <span {...stylex.props(styles.jobPostingArtifactCardText)}>
              자료를 생성하고 있어요. 최대 1분 정도 걸릴 수 있어요.
            </span>
          )}
        </div>

        {artifactError && (
          <Alert
            icon={
              <AlertCircle
                {...stylex.props(styles.detailErrorStateRefreshCw)}
              />
            }
            xstyle={styles.jobPostingArtifactCardAlert}
            variant="destructive"
          >
            <AlertDescription
              xstyle={styles.jobPostingArtifactCardAlertDescription}
            >
              {artifactError.message}
              {artifactError.canRetry && (
                <Button
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                >
                  <RefreshCw
                    {...stylex.props(styles.detailErrorStateRefreshCw)}
                  />
                  다시 시도
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {artifact && (
          <div {...stylex.props(styles.jobPostingArtifactCardContainer)}>
            <div {...stylex.props(styles.jobPostingArtifactCardRow2)}>
              <h3 {...stylex.props(styles.jobPostingArtifactCardHeading)}>
                {artifact.title}
              </h3>
              <Button
                xstyle={styles.jobPostingArtifactCardButton}
                size="sm"
                variant="outline"
                onClick={handleCopy}
              >
                {isCopied ? (
                  <Check {...stylex.props(styles.detailErrorStateRefreshCw)} />
                ) : (
                  <Copy {...stylex.props(styles.detailErrorStateRefreshCw)} />
                )}
                {isCopied ? '복사됨' : '복사하기'}
              </Button>
            </div>
            <p {...stylex.props(styles.jobPostingArtifactCardDescription2)}>
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
  useDocumentTitle(
    detail ? `${detail.company_name} ${detail.job_title}` : '채용공고 상세',
  );
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
        <ArrowLeft {...stylex.props(styles.detailErrorStateRefreshCw)} />
        채용공고 목록
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div
        {...stylex.props([styles.jobPostingDetailPageStack, motion.fadeIn])}
        data-stack=""
      >
        {backLink}
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        {...stylex.props([styles.jobPostingDetailPageStack, motion.fadeIn])}
        data-stack=""
      >
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
    <div
      {...stylex.props([styles.jobPostingDetailPageStack, motion.fadeIn])}
      data-stack=""
    >
      {backLink}

      {/* Page header */}
      <div {...stylex.props(styles.detailLoadingSkeletonStack2)} data-stack="">
        <p {...stylex.props(styles.jobPostingDetailPageDescription)}>
          Job Detail
        </p>
        <div {...stylex.props(styles.jobPostingDetailPageRow)}>
          <Building2 {...stylex.props(styles.jobPostingDetailPageBuilding2)} />
          <span {...stylex.props(styles.jobPostingDetailPageText)}>
            {detail.company_name}
          </span>
        </div>
        <h1 {...stylex.props(styles.jobPostingDetailPageHeading)}>
          {detail.job_title}
        </h1>
        <div {...stylex.props(styles.jobPostingDetailPageRow2)}>
          <Badge variant={platformVariant(detail.platform)}>
            {detail.platform}
          </Badge>
          <span {...stylex.props(styles.jobPostingDetailPageText2)}>
            {formatRelativeDate(detail.created_at)}
          </span>
          {safePostingUrl && (
            <Button
              xstyle={styles.jobPostingDetailPageButton}
              variant="outline"
              size="sm"
              asChild
            >
              <a href={safePostingUrl} rel="noreferrer" target="_blank">
                <ExternalLink
                  {...stylex.props(styles.detailErrorStateRefreshCw)}
                />
                원본 공고 보기
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Application status */}
      <Card>
        <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
          <div {...stylex.props(styles.jobPostingArtifactCardAlertDescription)}>
            <SectionHeading icon={ClipboardList} title="지원 상태" />
            <Badge
              variant={applicationStatusVariant(detail.application_status)}
            >
              {APPLICATION_STATUS_LABELS[detail.application_status]}
            </Badge>
            <label
              {...stylex.props(styles.jobPostingDetailPageLabel)}
              htmlFor="application-status"
            >
              지원 상태 변경
            </label>
            <select
              {...stylex.props([
                styles.jobPostingDetailPageSelect,
                surfaces.inputClean,
              ])}
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
              <span {...stylex.props(styles.jobPostingDetailPageText3)}>
                {formatRelativeDate(detail.status_updated_at)} 업데이트
              </span>
            )}
          </div>
          {statusError && (
            <Alert
              icon={
                <AlertCircle
                  {...stylex.props(styles.detailErrorStateRefreshCw)}
                />
              }
              xstyle={styles.jobPostingDetailPageAlert}
              variant="destructive"
            >
              <AlertDescription>{statusError.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Memo */}
      <Card>
        <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
          <div {...stylex.props(styles.jobPostingDetailPageRow3)}>
            <SectionHeading icon={StickyNote} title="메모" />
            <span {...stylex.props(styles.jobPostingDetailPageText3)}>
              {memoDraft.length} / {MEMO_MAX}
            </span>
          </div>
          <Textarea
            aria-label="메모"
            xstyle={styles.jobPostingDetailPageAlert}
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
            <Alert
              icon={
                <AlertCircle
                  {...stylex.props(styles.detailErrorStateRefreshCw)}
                />
              }
              xstyle={styles.jobPostingDetailPageAlert}
              variant="destructive"
            >
              <AlertDescription>{memoError.message}</AlertDescription>
            </Alert>
          )}
          {memoSuccess && (
            <Alert
              icon={
                <CheckCircle2
                  {...stylex.props(styles.detailErrorStateRefreshCw)}
                />
              }
              xstyle={styles.jobPostingDetailPageAlert}
              variant="success"
            >
              <AlertDescription>메모를 저장했습니다.</AlertDescription>
            </Alert>
          )}
          <div {...stylex.props(styles.jobPostingDetailPageRow4)}>
            <Button
              disabled={isSavingMemo || memoDraft === (detail.memo ?? '')}
              onClick={handleSaveMemo}
            >
              <Save {...stylex.props(styles.detailErrorStateRefreshCw)} />
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
          <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
            <div {...stylex.props(styles.jobPostingDetailPageRow5)}>
              {detail.location && (
                <span {...stylex.props(styles.jobPostingDetailPageText4)}>
                  <MapPin {...stylex.props(styles.sectionHeadingIcon)} />
                  {detail.location}
                </span>
              )}
              {detail.experience_req && (
                <span {...stylex.props(styles.jobPostingDetailPageText4)}>
                  <Briefcase {...stylex.props(styles.sectionHeadingIcon)} />
                  {detail.experience_req}
                </span>
              )}
              {detail.employment_type && (
                <span {...stylex.props(styles.jobPostingDetailPageText4)}>
                  <Clock {...stylex.props(styles.sectionHeadingIcon)} />
                  {detail.employment_type}
                </span>
              )}
              {detail.deadline && (
                <span {...stylex.props(styles.jobPostingDetailPageText5)}>
                  <Calendar
                    {...stylex.props(styles.detailErrorStateRefreshCw)}
                  />
                  마감: {detail.deadline}
                </span>
              )}
              {detail.salary && (
                <span {...stylex.props(styles.jobPostingDetailPageText4)}>
                  <DollarSign {...stylex.props(styles.sectionHeadingIcon)} />
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
          <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
            <SectionHeading icon={Code2} title="기술 스택" />
            <div {...stylex.props(styles.jobPostingDetailPageRow6)}>
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
            <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
              <SectionHeading icon={icon} title={title} />
              <p {...stylex.props(styles.jobPostingDetailPageDescription2)}>
                {content}
              </p>
            </CardContent>
          </Card>
        ))}

      {/* Additional info */}
      {additionalFields.length > 0 && (
        <Card>
          <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
            <SectionHeading icon={Info} title="추가 정보" />
            <dl {...stylex.props(styles.jobPostingDetailPageDl)}>
              {additionalFields.map(({ label, value }) => (
                <div
                  key={label}
                  {...stylex.props(styles.jobPostingDetailPageContainer)}
                >
                  <dt {...stylex.props(styles.jobPostingDetailPageDt)}>
                    {label}
                  </dt>
                  <dd {...stylex.props(styles.jobPostingDetailPageDd)}>
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
          <CardContent xstyle={styles.jobPostingArtifactCardCardContent}>
            <SectionHeading icon={Globe} title="홈페이지" />
            <a
              {...stylex.props(styles.jobPostingDetailPageLink)}
              href={safeHomepage}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink
                {...stylex.props(styles.jobPostingDetailPageExternalLink)}
              />
              {detail.homepage}
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const styles = stylex.create({
  sectionHeadingContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'hsl(var(--accent))',
    borderWidth: '1px',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.375rem',
    paddingBottom: '0.375rem',
  },
  sectionHeadingIcon: {
    height: '1rem',
    width: '1rem',
    color: 'hsl(var(--primary))',
  },
  sectionHeadingText: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 600,
  },
  detailLoadingSkeletonStack: {
    '--stack-space': '1.5rem',
  },
  detailLoadingSkeletonSkeleton: {
    height: '2rem',
    width: '7rem',
  },
  detailLoadingSkeletonStack2: {
    '--stack-space': '0.75rem',
  },
  detailLoadingSkeletonSkeleton2: {
    height: '1rem',
    width: '5rem',
  },
  detailLoadingSkeletonSkeleton3: {
    height: '1.25rem',
    width: '10rem',
  },
  detailLoadingSkeletonSkeleton4: {
    height: '2.25rem',
    width: '75%',
  },
  detailLoadingSkeletonRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  detailLoadingSkeletonSkeleton5: {
    height: '1.5rem',
    width: '4rem',
    borderRadius: '9999px',
  },
  detailLoadingSkeletonSkeleton6: {
    height: '1.5rem',
    width: '3.5rem',
  },
  detailLoadingSkeletonSkeleton7: {
    height: '2.25rem',
    width: '8rem',
    borderRadius: '.75rem',
  },
  detailLoadingSkeletonSkeleton8: {
    height: '5rem',
    width: '100%',
    borderRadius: '1rem',
  },
  detailLoadingSkeletonSkeleton9: {
    height: '7rem',
    width: '100%',
    borderRadius: '1rem',
  },
  detailLoadingSkeletonSkeleton10: {
    height: '9rem',
    width: '100%',
    borderRadius: '1rem',
  },
  detailErrorStateContainer: {
    minHeight: '22rem',
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 20%, transparent)',
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 8%, transparent)',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '3rem',
    paddingBottom: '3rem',
    textAlign: 'center',
  },
  detailErrorStateRow: {
    marginLeft: 'auto',
    marginRight: 'auto',
    display: 'flex',
    height: '3.5rem',
    width: '3.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 10%, transparent)',
    color: 'oklch(63.7% .237 25.331)',
  },
  detailErrorStateAlertCircle: {
    height: '1.75rem',
    width: '1.75rem',
  },
  detailErrorStateHeading: {
    marginTop: '1.25rem',
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  detailErrorStateDescription: {
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '0.5rem',
    maxWidth: '36rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  detailErrorStateDescription2: {
    marginTop: '0.75rem',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(63.7% .237 25.331)',
  },
  detailErrorStateButton: {
    marginTop: '1.5rem',
  },
  detailErrorStateRefreshCw: {
    height: '1rem',
    width: '1rem',
  },
  jobPostingArtifactCardCardContent: {
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
  },
  jobPostingArtifactCardDescription: {
    marginTop: '0.75rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingArtifactCardGrid: {
    marginTop: '1rem',
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  jobPostingArtifactCardStack: {
    '--stack-space': '0.5rem',
  },
  jobPostingArtifactCardSelect: {
    height: '2.5rem',
    width: '100%',
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    outlineStyle: {
      default: null,
      ':focus-visible': 'none',
    },
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    opacity: {
      default: null,
      ':disabled': 0.5,
    },
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  jobPostingArtifactCardRow: {
    marginTop: '1rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.75rem',
  },
  jobPostingArtifactCardLoader2: {
    height: '1rem',
    width: '1rem',
  },
  jobPostingArtifactCardText: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingArtifactCardAlert: {
    marginTop: '1rem',
  },
  jobPostingArtifactCardAlertDescription: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.75rem',
  },
  jobPostingArtifactCardContainer: {
    marginTop: '1rem',
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    backgroundColor: 'color-mix(in oklab, hsl(var(--primary)) 8%, transparent)',
    paddingTop: '1rem',
    paddingRight: '1rem',
    paddingBottom: '1rem',
    paddingLeft: '1rem',
  },
  jobPostingArtifactCardRow2: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  jobPostingArtifactCardHeading: {
    fontSize: '.875rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  jobPostingArtifactCardButton: {
    flexShrink: 0,
  },
  jobPostingArtifactCardDescription2: {
    marginTop: '0.75rem',
    fontSize: '.875rem',
    lineHeight: 1.625,
    whiteSpace: 'pre-wrap',
  },
  jobPostingDetailPageStack: {
    '--stack-space': '1.5rem',
  },
  jobPostingDetailPageDescription: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  jobPostingDetailPageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  jobPostingDetailPageBuilding2: {
    height: '1rem',
    width: '1rem',
    flexShrink: 0,
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingDetailPageText: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingDetailPageHeading: {
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 40rem)': '1.875rem',
    },
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  jobPostingDetailPageRow2: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
  },
  jobPostingDetailPageText2: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(55.1% .027 264.364)',
  },
  jobPostingDetailPageButton: {
    marginLeft: {
      default: null,
      '@media (min-width: 40rem)': '0.5rem',
    },
  },
  jobPostingDetailPageLabel: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  jobPostingDetailPageSelect: {
    height: '2.5rem',
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    outlineStyle: {
      default: null,
      ':focus-visible': 'none',
    },
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    opacity: {
      default: null,
      ':disabled': 0.5,
    },
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  jobPostingDetailPageText3: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(55.1% .027 264.364)',
  },
  jobPostingDetailPageAlert: {
    marginTop: '0.75rem',
  },
  jobPostingDetailPageRow3: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  jobPostingDetailPageRow4: {
    marginTop: '0.75rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  jobPostingDetailPageRow5: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: '1.25rem',
    rowGap: '0.75rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
  },
  jobPostingDetailPageText4: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingDetailPageText5: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: 'oklch(57.7% .245 27.325)',
  },
  jobPostingDetailPageRow6: {
    marginTop: '0.75rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  jobPostingDetailPageDescription2: {
    marginTop: '0.75rem',
    whiteSpace: 'pre-line',
    fontSize: '.875rem',
    lineHeight: 1.625,
  },
  jobPostingDetailPageDl: {
    marginTop: '0.75rem',
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  jobPostingDetailPageContainer: {
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, #fff 8%, transparent)',
    backgroundColor: 'hsl(var(--muted))',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
  },
  jobPostingDetailPageDt: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '.025em',
    color: 'oklch(55.1% .027 264.364)',
    textTransform: 'uppercase',
  },
  jobPostingDetailPageDd: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: 'hsl(var(--foreground))',
  },
  jobPostingDetailPageLink: {
    marginTop: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'hsl(var(--primary))',
    textDecorationLine: {
      default: null,
      ':hover': 'underline',
    },
  },
  jobPostingDetailPageExternalLink: {
    height: '0.875rem',
    width: '0.875rem',
  },
});
