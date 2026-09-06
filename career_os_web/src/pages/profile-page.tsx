import * as stylex from '@stylexjs/stylex';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Save,
  UserCircle,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LiveRegion } from '@/components/ui/live-region';
import { Skeleton } from '@/components/ui/skeleton';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { fetchUserProfile, saveUserProfile } from '../services/user-profile';
import type { UserProfile, UserProfileUpsert } from '../types/user-profile';

// §3 field limits, enforced client-side so the server 422 is a fallback.
const HEADLINE_MAX = 200;
const SALARY_MAX = 200;
const SUMMARY_MAX = 8000;
const TAG_MAX_LENGTH = 100;
const TARGET_ROLES_MAX = 20;
const SKILLS_MAX = 50;
const LOCATIONS_MAX = 20;
const YEARS_MIN = 0;
const YEARS_MAX = 60;
const YEARS_ERROR_MESSAGE = `경력 연차는 ${YEARS_MIN}~${YEARS_MAX} 사이의 정수로 입력해주세요.`;
const YEARS_FIELD_ID = 'profile-years';
const YEARS_ERROR_ID = 'profile-years-error';

interface ProfileFormState {
  headline: string;
  yearsExperience: string;
  targetRoles: string[];
  skills: string[];
  locations: string[];
  salaryExpectation: string;
  summary: string;
}

function toProfileFormState(profile: UserProfile | null): ProfileFormState {
  return {
    headline: profile?.headline ?? '',
    yearsExperience:
      profile?.years_experience != null ? String(profile.years_experience) : '',
    targetRoles: profile?.target_roles ?? [],
    skills: profile?.skills ?? [],
    locations: profile?.locations ?? [],
    salaryExpectation: profile?.salary_expectation ?? '',
    summary: profile?.summary ?? '',
  };
}

function toProfileUpsert(form: ProfileFormState): UserProfileUpsert {
  const years = form.yearsExperience.trim();
  return {
    headline: form.headline.trim() || null,
    years_experience: years === '' ? null : Number(years),
    target_roles: form.targetRoles.length > 0 ? form.targetRoles : null,
    skills: form.skills.length > 0 ? form.skills : null,
    locations: form.locations.length > 0 ? form.locations : null,
    salary_expectation: form.salaryExpectation.trim() || null,
    summary: form.summary.trim() || null,
  };
}

// Drops over-long entries and enforces the item cap before committing tags.
function clampProfileTags(next: string[], maxItems: number): string[] {
  return next.filter((tag) => tag.length <= TAG_MAX_LENGTH).slice(0, maxItems);
}

function ProfileLoadError({
  error,
  onRetry,
}: {
  error: UserFacingError;
  onRetry: () => void;
}) {
  return (
    <div {...stylex.props(styles.profileLoadErrorContainer)}>
      <div {...stylex.props(styles.profileLoadErrorRow)}>
        <AlertCircle {...stylex.props(styles.profileLoadErrorAlertCircle)} />
      </div>
      <h2 {...stylex.props(styles.profileLoadErrorHeading)}>
        프로필을 불러오지 못했습니다
      </h2>
      <p {...stylex.props(styles.profileLoadErrorDescription)}>
        {error.message}
      </p>
      <p {...stylex.props(styles.profileLoadErrorDescription2)}>{error.code}</p>
      <Button
        xstyle={styles.profileLoadErrorButton}
        variant="outline"
        onClick={() => onRetry()}
      >
        <RefreshCw {...stylex.props(styles.profileLoadErrorRefreshCw)} />
        다시 시도
      </Button>
    </div>
  );
}

export function ProfilePage() {
  useDocumentTitle('프로필');
  const [form, setForm] = useState<ProfileFormState>(toProfileFormState(null));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<UserFacingError | null>(null);
  const [isNewProfile, setIsNewProfile] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<UserFacingError | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Field-level (not page-level) so the invalid control is what the screen
  // reader describes; server failures still use the page-level saveError Alert.
  const [yearsError, setYearsError] = useState<string | null>(null);

  const loadProfile = useCallback((signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);

    fetchUserProfile(signal)
      .then((profile) => {
        setForm(toProfileFormState(profile));
        setIsNewProfile(profile === null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoadError(toUserFacingError(err, '프로필을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const years = form.yearsExperience.trim();
    if (
      years !== '' &&
      (!Number.isInteger(Number(years)) ||
        Number(years) < YEARS_MIN ||
        Number(years) > YEARS_MAX)
    ) {
      setSaveSuccess(false);
      setYearsError(YEARS_ERROR_MESSAGE);
      requestAnimationFrame(() => {
        document.getElementById(YEARS_FIELD_ID)?.focus();
      });
      return;
    }

    setIsSaving(true);
    setYearsError(null);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saved = await saveUserProfile(toProfileUpsert(form));
      setForm(toProfileFormState(saved));
      setIsNewProfile(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(toUserFacingError(err, '프로필을 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div
        {...stylex.props([styles.profilePageStack, motion.fadeIn])}
        data-stack=""
      >
        <Skeleton xstyle={styles.profilePageSkeleton} />
        <Card>
          <CardContent xstyle={styles.profilePageCardContent} data-stack="">
            <Skeleton xstyle={styles.profilePageSkeleton2} />
            <Skeleton xstyle={styles.profilePageSkeleton3} />
            <Skeleton xstyle={styles.profilePageSkeleton2} />
            <Skeleton xstyle={styles.profilePageSkeleton4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        {...stylex.props([styles.profilePageStack, motion.fadeIn])}
        data-stack=""
      >
        <ProfileLoadError error={loadError} onRetry={loadProfile} />
      </div>
    );
  }

  return (
    <div
      {...stylex.props([styles.profilePageStack, motion.fadeIn])}
      data-stack=""
    >
      <LiveRegion politeness="polite">
        {isSaving ? '프로필을 저장하는 중입니다…' : ''}
      </LiveRegion>
      <div>
        <p {...stylex.props(styles.profilePageDescription)}>Career Profile</p>
        <h1 {...stylex.props(styles.profilePageHeading)}>
          <UserCircle {...stylex.props(styles.profilePageUserCircle)} />
          프로필
        </h1>
        {isNewProfile && (
          <p {...stylex.props(styles.profilePageDescription2)}>
            프로필을 저장하면 AI 지원 전략 기능이 정확해져요.
          </p>
        )}
      </div>

      <Card>
        <CardContent xstyle={styles.profilePageCardContent2}>
          {/*
            noValidate hands validation to handleSubmit: native constraint
            bubbles would otherwise suppress the submit event (blocking our JS
            checks) and are poorly announced by screen readers. We keep the
            min/max/step attributes on the number input for spinner UX.
          */}
          <form
            {...stylex.props(styles.profilePageForm)}
            data-stack=""
            noValidate
            onSubmit={handleSubmit}
          >
            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor="profile-headline">한 줄 소개</Label>
              <Input
                id="profile-headline"
                maxLength={HEADLINE_MAX}
                placeholder="예: 5년 차 백엔드 엔지니어"
                value={form.headline}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, headline: e.target.value }))
                }
              />
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor={YEARS_FIELD_ID}>경력 연차</Label>
              <Input
                id={YEARS_FIELD_ID}
                aria-describedby={yearsError ? YEARS_ERROR_ID : undefined}
                xstyle={styles.profilePageInput}
                error={!!yearsError}
                inputMode="numeric"
                max={YEARS_MAX}
                min={YEARS_MIN}
                placeholder="0"
                step={1}
                type="number"
                value={form.yearsExperience}
                onChange={(e) => {
                  if (yearsError) setYearsError(null);
                  setForm((prev) => ({
                    ...prev,
                    yearsExperience: e.target.value,
                  }));
                }}
              />
              {yearsError && (
                <p
                  {...stylex.props(styles.profilePageDescription3)}
                  id={YEARS_ERROR_ID}
                >
                  {yearsError}
                </p>
              )}
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor="profile-target-roles">희망 직무</Label>
              <TagInput
                id="profile-target-roles"
                placeholder="직무 입력 후 Enter"
                value={form.targetRoles}
                onChange={(tags) =>
                  setForm((prev) => ({
                    ...prev,
                    targetRoles: clampProfileTags(tags, TARGET_ROLES_MAX),
                  }))
                }
              />
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor="profile-skills">보유 기술</Label>
              <TagInput
                id="profile-skills"
                placeholder="기술 입력 후 Enter"
                value={form.skills}
                onChange={(tags) =>
                  setForm((prev) => ({
                    ...prev,
                    skills: clampProfileTags(tags, SKILLS_MAX),
                  }))
                }
              />
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor="profile-locations">희망 근무지</Label>
              <TagInput
                id="profile-locations"
                placeholder="지역 입력 후 Enter"
                value={form.locations}
                onChange={(tags) =>
                  setForm((prev) => ({
                    ...prev,
                    locations: clampProfileTags(tags, LOCATIONS_MAX),
                  }))
                }
              />
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <Label htmlFor="profile-salary">희망 연봉</Label>
              <Input
                id="profile-salary"
                maxLength={SALARY_MAX}
                placeholder="예: 6,000만원 이상"
                value={form.salaryExpectation}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    salaryExpectation: e.target.value,
                  }))
                }
              />
            </div>

            <div {...stylex.props(styles.profilePageStack2)} data-stack="">
              <div {...stylex.props(styles.profilePageRow)}>
                <Label htmlFor="profile-summary">경력 요약</Label>
                <span {...stylex.props(styles.profilePageText)}>
                  {form.summary.length} / {SUMMARY_MAX}
                </span>
              </div>
              <Textarea
                id="profile-summary"
                xstyle={styles.profilePageTextarea}
                maxLength={SUMMARY_MAX}
                placeholder="경력, 강점, 주요 프로젝트 등을 자유롭게 작성해주세요."
                value={form.summary}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, summary: e.target.value }))
                }
              />
            </div>

            {saveSuccess && (
              <Alert
                icon={
                  <CheckCircle2
                    {...stylex.props(styles.profileLoadErrorRefreshCw)}
                  />
                }
                variant="success"
              >
                <AlertDescription>프로필을 저장했습니다.</AlertDescription>
              </Alert>
            )}

            {saveError && (
              <Alert
                icon={
                  <AlertCircle
                    {...stylex.props(styles.profileLoadErrorRefreshCw)}
                  />
                }
                variant="destructive"
              >
                <AlertDescription>{saveError.message}</AlertDescription>
              </Alert>
            )}

            <div {...stylex.props(styles.profilePageRow2)}>
              <Button disabled={isSaving} type="submit">
                <Save {...stylex.props(styles.profileLoadErrorRefreshCw)} />
                {isSaving ? '저장 중…' : '프로필 저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  profileLoadErrorContainer: {
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
  profileLoadErrorRow: {
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
  profileLoadErrorAlertCircle: {
    height: '1.75rem',
    width: '1.75rem',
  },
  profileLoadErrorHeading: {
    marginTop: '1.25rem',
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  profileLoadErrorDescription: {
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '0.5rem',
    maxWidth: '36rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  profileLoadErrorDescription2: {
    marginTop: '0.75rem',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(63.7% .237 25.331)',
  },
  profileLoadErrorButton: {
    marginTop: '1.5rem',
  },
  profileLoadErrorRefreshCw: {
    height: '1rem',
    width: '1rem',
  },
  profilePageStack: {
    '--stack-space': '1.5rem',
  },
  profilePageSkeleton: {
    height: '2.25rem',
    width: '10rem',
  },
  profilePageCardContent: {
    '--stack-space': '1.25rem',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  profilePageSkeleton2: {
    height: '2.5rem',
    width: '100%',
  },
  profilePageSkeleton3: {
    height: '2.5rem',
    width: '50%',
  },
  profilePageSkeleton4: {
    height: '6rem',
    width: '100%',
  },
  profilePageDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  profilePageHeading: {
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
  profilePageUserCircle: {
    height: '1.75rem',
    width: '1.75rem',
    color: 'hsl(var(--primary))',
  },
  profilePageDescription2: {
    marginTop: '0.5rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  profilePageCardContent2: {
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  profilePageForm: {
    '--stack-space': '1.5rem',
  },
  profilePageStack2: {
    '--stack-space': '0.5rem',
  },
  profilePageInput: {
    maxWidth: {
      default: null,
      '@media (min-width: 40rem)': '10rem',
    },
  },
  profilePageDescription3: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(70.4% .191 22.216)',
  },
  profilePageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profilePageText: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(55.1% .027 264.364)',
  },
  profilePageTextarea: {
    minHeight: '10rem',
  },
  profilePageRow2: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
});
