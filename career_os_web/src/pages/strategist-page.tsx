import * as stylex from '@stylexjs/stylex';
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
import { motion } from '@/styles/motion';
import { surfaces } from '@/styles/surfaces';
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
      <p {...stylex.props(styles.pageHeaderDescription)}>
        Application Strategist
      </p>
      <h1 {...stylex.props(styles.pageHeaderHeading)}>
        <Sparkles {...stylex.props(styles.pageHeaderSparkles)} />
        지원 전략
      </h1>
      <p {...stylex.props(styles.pageHeaderDescription2)}>
        저장한 공고를 분석해 적합도와 우선순위, 다음 액션을 제안해드려요.
      </p>
    </div>
  );
}

function BootstrapSkeleton() {
  return (
    <Card>
      <CardContent xstyle={styles.bootstrapSkeletonCardContent} data-stack="">
        <Skeleton xstyle={styles.bootstrapSkeletonSkeleton} />
        <Skeleton xstyle={styles.bootstrapSkeletonSkeleton} />
        <Skeleton xstyle={styles.bootstrapSkeletonSkeleton2} />
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
    <div {...stylex.props(styles.strategistErrorStateContainer)}>
      <div {...stylex.props(styles.strategistErrorStateRow)}>
        <AlertCircle
          {...stylex.props(styles.strategistErrorStateAlertCircle)}
        />
      </div>
      <h2 {...stylex.props(styles.strategistErrorStateHeading)}>
        데이터를 불러오지 못했습니다
      </h2>
      <p {...stylex.props(styles.strategistErrorStateDescription)}>
        {error.message}
      </p>
      <p {...stylex.props(styles.strategistErrorStateDescription2)}>
        {error.code}
      </p>
      <Button
        xstyle={styles.strategistErrorStateButton}
        variant="outline"
        onClick={() => onRetry()}
      >
        <RefreshCw {...stylex.props(styles.strategistErrorStateRefreshCw)} />
        다시 시도
      </Button>
    </div>
  );
}

function NoProfileCta() {
  return (
    <Card>
      <CardContent xstyle={styles.noProfileCtaCardContent}>
        <div {...stylex.props(styles.noProfileCtaRow)}>
          <Sparkles {...stylex.props(styles.noProfileCtaSparkles)} />
        </div>
        <div>
          <h2 {...stylex.props(styles.noProfileCtaHeading)}>
            먼저 프로필을 작성해주세요
          </h2>
          <p {...stylex.props(styles.noProfileCtaDescription)}>
            지원 전략 플랜을 만들려면 먼저 프로필을 작성해주세요.
          </p>
        </div>
        <Button asChild>
          <Link to="/profile">
            프로필 작성하기
            <ArrowRight
              {...stylex.props(styles.strategistErrorStateRefreshCw)}
            />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FeatureUnavailable() {
  return (
    <Card>
      <CardContent xstyle={styles.featureUnavailableCardContent}>
        <div {...stylex.props(styles.featureUnavailableRow)}>
          <Clock {...stylex.props(styles.noProfileCtaSparkles)} />
        </div>
        <h2 {...stylex.props(styles.noProfileCtaHeading)}>
          아직 준비 중인 기능이에요.
        </h2>
        <p {...stylex.props(styles.featureUnavailableDescription)}>
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
    <div {...stylex.props(styles.skillBadgesStack)} data-stack="">
      <span {...stylex.props(styles.skillBadgesText)}>{label}</span>
      <div {...stylex.props(styles.skillBadgesRow)}>
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
      <CardContent xstyle={styles.planItemCardCardContent} data-stack="">
        <div {...stylex.props(styles.planItemCardRow)}>
          <span {...stylex.props(styles.planItemCardText)}>{rank}</span>
          <div {...stylex.props(styles.planItemCardContainer)}>
            <Link
              {...stylex.props(styles.planItemCardLink)}
              to={`/job-postings/${item.job_id}`}
            >
              {item.job_title}
            </Link>
            <div {...stylex.props(styles.planItemCardContainer2)}>
              {item.company_name}
            </div>
          </div>
          <Badge variant={deadlineUrgencyVariant(item.deadline_urgency)}>
            {DEADLINE_URGENCY_LABELS[item.deadline_urgency]}
          </Badge>
        </div>

        <div {...stylex.props(styles.planItemCardRow2)}>
          <span {...stylex.props(styles.planItemCardText2)}>적합도</span>
          <div {...stylex.props(styles.planItemCardContainer3)}>
            <div
              {...stylex.props(
                styles.planItemCardContainer4,
                styles.fitScore(score),
              )}
            />
          </div>
          <span {...stylex.props(styles.planItemCardText3)}>{score}</span>
        </div>

        {(item.matched_skills.length > 0 || item.missing_skills.length > 0) && (
          <div {...stylex.props(styles.planItemCardGrid)}>
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

        <div {...stylex.props(styles.planItemCardContainer5)}>
          <div {...stylex.props(styles.planItemCardRow3)}>
            <Lightbulb {...stylex.props(styles.planItemCardLightbulb)} />
            추천 액션
          </div>
          <p {...stylex.props(styles.planItemCardDescription)}>
            {item.recommended_action}
          </p>
        </div>

        {item.rationale && (
          <p {...stylex.props(styles.planItemCardDescription2)}>
            {item.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanResult({ plan }: { plan: ApplicationPlan }) {
  return (
    <div {...stylex.props(styles.planResultStack)} data-stack="">
      <Card>
        <CardContent xstyle={styles.planResultCardContent}>
          <div {...stylex.props(styles.planResultRow)}>
            <Sparkles {...stylex.props(styles.planItemCardLightbulb)} />
            플랜 요약
          </div>
          <p {...stylex.props(styles.planResultDescription)}>{plan.summary}</p>
        </CardContent>
      </Card>

      {plan.items.length === 0 ? (
        <Card>
          <CardContent xstyle={styles.planResultCardContent2}>
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
      <CardContent xstyle={styles.proposedActionCardCardContent} data-stack="">
        <div>
          <p {...stylex.props(styles.proposedActionCardDescription)}>
            {description}
          </p>
          {action.reason && (
            <p {...stylex.props(styles.noProfileCtaDescription)}>
              {action.reason}
            </p>
          )}
        </div>

        {error && (
          <Alert
            icon={
              <AlertCircle
                {...stylex.props(styles.strategistErrorStateRefreshCw)}
              />
            }
            variant="destructive"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {phase === 'applied' ? (
          <div {...stylex.props(styles.proposedActionCardRow)}>
            <Check {...stylex.props(styles.strategistErrorStateRefreshCw)} />
            적용됨
          </div>
        ) : (
          <div {...stylex.props(styles.proposedActionCardRow2)}>
            <Button
              disabled={phase === 'applying' || patch === null}
              size="sm"
              onClick={handleApply}
            >
              {phase === 'applying' ? (
                <Loader2
                  {...stylex.props([
                    styles.proposedActionCardLoader2,
                    motion.spin,
                  ])}
                />
              ) : (
                <Check
                  {...stylex.props(styles.strategistErrorStateRefreshCw)}
                />
              )}
              적용
            </Button>
            <Button
              disabled={phase === 'applying'}
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
            >
              <X {...stylex.props(styles.strategistErrorStateRefreshCw)} />
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
    <div {...stylex.props(styles.proposedActionListStack)} data-stack="">
      <div {...stylex.props(styles.planResultRow)}>
        <ListChecks {...stylex.props(styles.planItemCardLightbulb)} />
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
      <div {...stylex.props(styles.strategistPageStack)} data-stack="">
        <Card>
          <CardContent
            xstyle={styles.bootstrapSkeletonCardContent}
            data-stack=""
          >
            <div {...stylex.props(styles.strategistPageStack2)} data-stack="">
              <Label htmlFor="strategist-group">분석할 구직 활동</Label>
              <select
                {...stylex.props([
                  styles.strategistPageSelect,
                  surfaces.inputClean,
                ])}
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

            <div {...stylex.props(styles.strategistPageStack2)} data-stack="">
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

            <div {...stylex.props(styles.planItemCardRow2)}>
              <Button disabled={isGenerating} onClick={handleGenerate}>
                {isGenerating ? (
                  <Loader2
                    {...stylex.props([
                      styles.proposedActionCardLoader2,
                      motion.spin,
                    ])}
                  />
                ) : (
                  <Sparkles
                    {...stylex.props(styles.strategistErrorStateRefreshCw)}
                  />
                )}
                {isGenerating ? '생성 중…' : '플랜 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isGenerating && (
          <div
            {...stylex.props([styles.strategistPageContainer, motion.fadeIn])}
          >
            <div {...stylex.props(styles.strategistPageContainer2)}>
              <div
                {...stylex.props([
                  styles.strategistPageContainer3,
                  motion.indeterminate,
                ])}
              />
            </div>
            <div {...stylex.props(styles.planItemCardRow)}>
              <div {...stylex.props(styles.strategistPageRow)}>
                <Sparkles
                  {...stylex.props([
                    styles.strategistPageSparkles,
                    motion.pulse,
                  ])}
                />
              </div>
              <div>
                <p {...stylex.props(styles.proposedActionCardDescription)}>
                  AI가 채용공고를 분석 중이에요
                </p>
                <p {...stylex.props(styles.strategistPageDescription)}>
                  저장된 공고와 프로필을 비교해 지원 전략 플랜을 만들고 있어요.
                  최대 1분 정도 걸릴 수 있어요.
                </p>
              </div>
            </div>
          </div>
        )}

        {generateError && (
          <Alert
            icon={
              <AlertCircle
                {...stylex.props(styles.strategistErrorStateRefreshCw)}
              />
            }
            variant="destructive"
          >
            <AlertDescription xstyle={styles.strategistPageAlertDescription}>
              {generateError.message}
              {generateError.canRetry && (
                <Button
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                >
                  <RefreshCw
                    {...stylex.props(styles.strategistErrorStateRefreshCw)}
                  />
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
    <div
      {...stylex.props([styles.strategistPageStack3, motion.fadeIn])}
      data-stack=""
    >
      <PageHeader />
      {body}
    </div>
  );
}

const styles = stylex.create({
  fitScore: (score: number) => ({ width: `${score}%` }),
  pageHeaderDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  pageHeaderHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 40rem)': '1.875rem',
    },
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  pageHeaderSparkles: {
    height: '1.75rem',
    width: '1.75rem',
    color: 'hsl(var(--primary))',
  },
  pageHeaderDescription2: {
    marginTop: '0.5rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  bootstrapSkeletonCardContent: {
    '--stack-space': '1.25rem',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  bootstrapSkeletonSkeleton: {
    height: '2.5rem',
    width: '100%',
  },
  bootstrapSkeletonSkeleton2: {
    height: '2.5rem',
    width: '10rem',
  },
  strategistErrorStateContainer: {
    minHeight: '18rem',
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
  strategistErrorStateRow: {
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
  strategistErrorStateAlertCircle: {
    height: '1.75rem',
    width: '1.75rem',
  },
  strategistErrorStateHeading: {
    marginTop: '1.25rem',
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  strategistErrorStateDescription: {
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '0.5rem',
    maxWidth: '36rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  strategistErrorStateDescription2: {
    marginTop: '0.75rem',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(63.7% .237 25.331)',
  },
  strategistErrorStateButton: {
    marginTop: '1.5rem',
  },
  strategistErrorStateRefreshCw: {
    height: '1rem',
    width: '1rem',
  },
  noProfileCtaCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1rem',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  noProfileCtaRow: {
    display: 'flex',
    height: '3rem',
    width: '3rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 12%, transparent)',
    color: 'hsl(var(--primary))',
  },
  noProfileCtaSparkles: {
    height: '1.5rem',
    width: '1.5rem',
  },
  noProfileCtaHeading: {
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  noProfileCtaDescription: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  featureUnavailableCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '3rem',
    paddingBottom: '3rem',
    textAlign: 'center',
  },
  featureUnavailableRow: {
    display: 'flex',
    height: '3rem',
    width: '3rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor: 'hsl(var(--muted))',
    color: 'oklch(55.1% .027 264.364)',
  },
  featureUnavailableDescription: {
    maxWidth: '28rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  skillBadgesStack: {
    '--stack-space': '0.375rem',
  },
  skillBadgesText: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '.025em',
    color: 'oklch(55.1% .027 264.364)',
    textTransform: 'uppercase',
  },
  skillBadgesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  planItemCardCardContent: {
    '--stack-space': '1rem',
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
  },
  planItemCardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  planItemCardText: {
    display: 'flex',
    height: '1.75rem',
    width: '1.75rem',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 700,
    color: 'hsl(var(--primary))',
  },
  planItemCardContainer: {
    minWidth: '0rem',
    flex: '1',
  },
  planItemCardLink: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-.025em',
    textDecorationLine: {
      default: null,
      ':hover': 'underline',
    },
  },
  planItemCardContainer2: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  planItemCardRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  planItemCardText2: {
    width: '3rem',
    flexShrink: 0,
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(55.1% .027 264.364)',
  },
  planItemCardContainer3: {
    height: '0.5rem',
    flex: '1',
    overflow: 'hidden',
    borderRadius: '9999px',
    backgroundColor: 'hsl(var(--muted))',
  },
  planItemCardContainer4: {
    height: '100%',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
  },
  planItemCardText3: {
    width: '2.5rem',
    flexShrink: 0,
    textAlign: 'right',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 700,
    color: 'hsl(var(--primary))',
  },
  planItemCardGrid: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  planItemCardContainer5: {
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    backgroundColor: 'color-mix(in oklab, hsl(var(--primary)) 8%, transparent)',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
  },
  planItemCardRow3: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'hsl(var(--primary))',
  },
  planItemCardLightbulb: {
    height: '0.875rem',
    width: '0.875rem',
  },
  planItemCardDescription: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: 'hsl(var(--foreground))',
  },
  planItemCardDescription2: {
    fontSize: '.875rem',
    lineHeight: 1.625,
    color: 'oklch(44.6% .03 256.802)',
  },
  planResultStack: {
    '--stack-space': '1rem',
  },
  planResultCardContent: {
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
  },
  planResultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '.025em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  planResultDescription: {
    marginTop: '0.5rem',
    fontSize: '.875rem',
    lineHeight: 1.625,
    whiteSpace: 'pre-line',
  },
  planResultCardContent2: {
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '3rem',
    paddingBottom: '3rem',
    textAlign: 'center',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  proposedActionCardCardContent: {
    '--stack-space': '0.75rem',
    paddingTop: '1rem',
    paddingRight: '1rem',
    paddingBottom: '1rem',
    paddingLeft: '1rem',
  },
  proposedActionCardDescription: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 600,
    color: 'hsl(var(--foreground))',
  },
  proposedActionCardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 600,
    color: 'hsl(var(--primary))',
  },
  proposedActionCardRow2: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
  },
  proposedActionCardLoader2: {
    height: '1rem',
    width: '1rem',
  },
  proposedActionListStack: {
    '--stack-space': '0.75rem',
  },
  strategistPageStack: {
    '--stack-space': '1.5rem',
  },
  strategistPageStack2: {
    '--stack-space': '0.5rem',
  },
  strategistPageSelect: {
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
  strategistPageContainer: {
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
    backgroundColor: 'color-mix(in oklab, hsl(var(--primary)) 5%, transparent)',
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
  },
  strategistPageContainer2: {
    position: 'relative',
    marginBottom: '1rem',
    height: '0.25rem',
    overflow: 'hidden',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
  },
  strategistPageContainer3: {
    position: 'absolute',
    top: '0rem',
    bottom: '0rem',
    left: '0rem',
    width: '40%',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
  },
  strategistPageRow: {
    display: 'flex',
    height: '2.5rem',
    width: '2.5rem',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 10%, transparent)',
    color: 'hsl(var(--primary))',
  },
  strategistPageSparkles: {
    height: '1.25rem',
    width: '1.25rem',
  },
  strategistPageDescription: {
    marginTop: '0.125rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  strategistPageAlertDescription: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.75rem',
  },
  strategistPageStack3: {
    '--stack-space': '1.5rem',
  },
});
