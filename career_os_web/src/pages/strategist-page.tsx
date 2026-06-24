import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  ApiError,
  toUserFacingError,
  type UserFacingError,
} from '../services/api-error';
import { updateJobPosting } from '../services/job-postings';
import { fetchJobSearchGroups } from '../services/job-search-groups';
import { generateApplicationPlan } from '../services/strategist';
import { fetchUserProfile } from '../services/user-profile';
import type {
  ApplicationPlan,
  PlanItem,
  ProposedAction,
} from '../types/application-plan';
import type { JobPostingUpdate } from '../types/job-posting';
import type { JobSearchGroupItem } from '../types/job-search-group';
import {
  DEADLINE_URGENCY_LABELS,
  deadlineUrgencyVariant,
  describeProposedAction,
} from '../utils/strategist-formatters';

const FOCUS_MAX = 300;

// Clamp the model's fit score into the visualizable 0–100 range. The Zod schema
// keeps validation shape-only (a stray out-of-range value should not fail the
// whole contract), so range safety is enforced here at the render boundary.
function clampFitScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function PageHeader() {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
        Application Strategist
      </p>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
        <Sparkles className="h-7 w-7 text-primary" />
        지원 전략
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        저장한 공고를 분석해 적합도와 우선순위, 다음 액션을 제안해드려요.
      </p>
    </div>
  );
}

function BootstrapSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  );
}

function StrategistErrorState({
  error,
  onRetry,
}: {
  error: UserFacingError;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-[18rem] rounded-xl border border-red-500/20 bg-red-500/8 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight">
        데이터를 불러오지 못했습니다
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

function NoProfileCta() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            먼저 프로필을 작성해주세요
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            지원 전략 플랜을 만들려면 먼저 프로필을 작성해주세요.
          </p>
        </div>
        <Button asChild>
          <Link to="/profile">
            프로필 작성하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FeatureUnavailable() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-gray-500">
          <Clock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">
          아직 준비 중인 기능이에요.
        </h2>
        <p className="max-w-md text-sm text-gray-600">
          지원 전략 플랜은 곧 사용하실 수 있어요. 조금만 기다려주세요.
        </p>
      </CardContent>
    </Card>
  );
}

function SkillBadges({
  label,
  skills,
  variant,
}: {
  label: string;
  skills: string[];
  variant: 'success' | 'warning';
}) {
  if (skills.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <Badge key={skill} variant={variant}>
            {skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function PlanItemCard({ item, rank }: { item: PlanItem; rank: number }) {
  const score = clampFitScore(item.fit_score);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              className="text-base font-bold tracking-tight hover:underline"
              to={`/job-postings/${item.job_id}`}
            >
              {item.job_title}
            </Link>
            <div className="text-sm text-gray-600">{item.company_name}</div>
          </div>
          <Badge variant={deadlineUrgencyVariant(item.deadline_urgency)}>
            {DEADLINE_URGENCY_LABELS[item.deadline_urgency]}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-xs font-semibold text-gray-500">
            적합도
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary to-teal-400"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-bold text-primary">
            {score}
          </span>
        </div>

        {(item.matched_skills.length > 0 || item.missing_skills.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SkillBadges
              label="보유 역량"
              skills={item.matched_skills}
              variant="success"
            />
            <SkillBadges
              label="보완 필요"
              skills={item.missing_skills}
              variant="warning"
            />
          </div>
        )}

        <div className="rounded-xl border border-primary/15 bg-primary/8 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Lightbulb className="h-3.5 w-3.5" />
            추천 액션
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {item.recommended_action}
          </p>
        </div>

        {item.rationale && (
          <p className="text-sm leading-relaxed text-gray-600">
            {item.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanResult({ plan }: { plan: ApplicationPlan }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            플랜 요약
          </div>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
            {plan.summary}
          </p>
        </CardContent>
      </Card>

      {plan.items.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-gray-600">
            분석할 저장 공고가 없습니다. 먼저 채용 공고를 저장해주세요.
          </CardContent>
        </Card>
      ) : (
        plan.items.map((item, index) => (
          <PlanItemCard key={item.job_id} item={item} rank={index + 1} />
        ))
      )}
    </div>
  );
}

// Maps a proposed action to the single PATCH field that confirming it sends (§6).
// Returns null when the model omitted the field the action needs, so the card can
// disable "적용" rather than issue a malformed request.
function buildProposedActionPatch(
  action: ProposedAction,
): JobPostingUpdate | null {
  switch (action.action_type) {
    case 'set_status':
      return action.application_status
        ? { application_status: action.application_status }
        : null;
    case 'assign_group':
      return action.target_group_id
        ? { group_id: action.target_group_id }
        : null;
    case 'save_memo':
      // A save_memo proposal needs memo content; clearing a memo is a
      // detail-page concern, not something the strategist suggests.
      return action.memo ? { memo: action.memo } : null;
  }
}

// One confirm/dismiss card. Confirming issues the PATCH (server is the source of
// truth, no optimistic write); dismissing is purely local — no API call (§6).
function ProposedActionCard({
  action,
  description,
}: {
  action: ProposedAction;
  description: string;
}) {
  const [phase, setPhase] = useState<'idle' | 'applying' | 'applied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const patch = buildProposedActionPatch(action);

  if (isDismissed) return null;

  async function handleApply() {
    if (!patch) return;
    setPhase('applying');
    setError(null);
    try {
      await updateJobPosting(action.job_id, patch);
      setPhase('applied');
    } catch (err) {
      setError(toUserFacingError(err, '제안을 적용하지 못했습니다.').message);
      setPhase('idle');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{description}</p>
          {action.reason && (
            <p className="mt-1 text-sm text-gray-600">{action.reason}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {phase === 'applied' ? (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Check className="h-4 w-4" />
            적용됨
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={phase === 'applying' || patch === null}
              size="sm"
              onClick={handleApply}
            >
              {phase === 'applying' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              적용
            </Button>
            <Button
              disabled={phase === 'applying'}
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
              무시
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProposedActionList({
  plan,
  groups,
}: {
  plan: ApplicationPlan;
  groups: JobSearchGroupItem[];
}) {
  const actions = plan.proposed_actions ?? [];
  if (actions.length === 0) return null;

  // Resolve display names from data already on hand: job titles from the plan's
  // own items, group names from the selector's groups. Both fall back to the raw
  // id when an action references something outside those sets (§6).
  const jobTitleById = new Map(plan.items.map((i) => [i.job_id, i.job_title]));
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
        <ListChecks className="h-3.5 w-3.5" />
        제안된 액션
      </div>
      {actions.map((action) => {
        const jobTitle =
          jobTitleById.get(action.job_id) ?? `공고 #${action.job_id}`;
        const groupName =
          (action.target_group_id &&
            groupNameById.get(action.target_group_id)) ||
          action.target_group_id ||
          '';
        return (
          <ProposedActionCard
            key={`${action.action_type}:${action.job_id}:${action.application_status ?? ''}:${action.target_group_id ?? ''}:${action.memo ?? ''}`}
            action={action}
            description={describeProposedAction(action, jobTitle, groupName)}
          />
        );
      })}
    </div>
  );
}

export function StrategistPage() {
  useDocumentTitle('지원 전략');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<UserFacingError | null>(
    null,
  );
  const [hasProfile, setHasProfile] = useState(false);
  const [groups, setGroups] = useState<JobSearchGroupItem[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [focusText, setFocusText] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<ApplicationPlan | null>(null);
  const [generateError, setGenerateError] = useState<{
    message: string;
    canRetry: boolean;
  } | null>(null);
  const [isFeatureUnavailable, setIsFeatureUnavailable] = useState(false);

  const planControllerRef = useRef<AbortController | null>(null);

  const bootstrap = useCallback((signal?: AbortSignal) => {
    setIsBootstrapping(true);
    setBootstrapError(null);

    Promise.all([
      fetchUserProfile(signal),
      fetchJobSearchGroups({ status: 'active' }, signal),
    ])
      .then(([profile, groupsPage]) => {
        setHasProfile(profile !== null);
        setGroups(groupsPage.items);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setBootstrapError(
          toUserFacingError(err, '데이터를 불러오지 못했습니다.'),
        );
      })
      .finally(() => {
        if (!signal?.aborted) setIsBootstrapping(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    bootstrap(controller.signal);
    return () => controller.abort();
  }, [bootstrap]);

  // Cancel an in-flight plan request when the page unmounts so a 10–60 s run
  // does not keep burning model time after the user navigates away.
  useEffect(() => {
    return () => planControllerRef.current?.abort();
  }, []);

  async function handleGenerate() {
    planControllerRef.current?.abort();
    const controller = new AbortController();
    planControllerRef.current = controller;

    setIsGenerating(true);
    setGenerateError(null);
    setIsFeatureUnavailable(false);
    setPlan(null);

    try {
      const result = await generateApplicationPlan(
        {
          group_id: selectedGroupId === '' ? null : selectedGroupId,
          focus: focusText.trim() === '' ? null : focusText.trim(),
        },
        controller.signal,
      );
      setPlan(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      // 404 = feature flag off (§5.3): hide the form, show the "준비 중" card.
      if (err instanceof ApiError && err.status === 404) {
        setIsFeatureUnavailable(true);
        return;
      }
      // 429 carries a meaningful rate-limit message but retrying immediately
      // would just hit the limit again, so omit the retry affordance there.
      const canRetry = !(err instanceof ApiError && err.status === 429);
      setGenerateError({
        message: toUserFacingError(err, '플랜을 생성하지 못했습니다.').message,
        canRetry,
      });
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
      if (planControllerRef.current === controller) {
        planControllerRef.current = null;
      }
    }
  }

  let body: ReactNode;
  if (isBootstrapping) {
    body = <BootstrapSkeleton />;
  } else if (bootstrapError) {
    body = <StrategistErrorState error={bootstrapError} onRetry={bootstrap} />;
  } else if (!hasProfile) {
    body = <NoProfileCta />;
  } else if (isFeatureUnavailable) {
    body = <FeatureUnavailable />;
  } else {
    body = (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="strategist-group">분석할 구직 활동</Label>
              <select
                className="input-clean h-10 w-full rounded-xl px-3 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                disabled={isGenerating}
                id="strategist-group"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">현재 활동 그룹 (자동)</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategist-focus">집중할 방향 (선택)</Label>
              <Input
                disabled={isGenerating}
                id="strategist-focus"
                maxLength={FOCUS_MAX}
                placeholder="예: 이번 주는 백엔드 위주로"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={isGenerating} onClick={handleGenerate}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? '생성 중…' : '플랜 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isGenerating && (
          <div className="animate-fade-in rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="relative mb-4 h-1 overflow-hidden rounded-full bg-primary/15">
              <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-linear-to-r from-primary to-teal-400 animate-indeterminate" />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  AI가 채용공고를 분석 중이에요
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  저장된 공고와 프로필을 비교해 지원 전략 플랜을 만들고 있어요.
                  최대 1분 정도 걸릴 수 있어요.
                </p>
              </div>
            </div>
          </div>
        )}

        {generateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {generateError.message}
              {generateError.canRetry && (
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

        {plan && (
          <>
            <PlanResult plan={plan} />
            <ProposedActionList plan={plan} groups={groups} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader />
      {body}
    </div>
  );
}
