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
    <div className="min-h-[22rem] rounded-xl border border-red-500/20 bg-red-500/8 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight">
        프로필을 불러오지 못했습니다
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
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-40" />
        <Card>
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="animate-fade-in space-y-6">
        <ProfileLoadError error={loadError} onRetry={loadProfile} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <LiveRegion politeness="polite">
        {isSaving ? '프로필을 저장하는 중입니다…' : ''}
      </LiveRegion>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
          Career Profile
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <UserCircle className="h-7 w-7 text-primary" />
          프로필
        </h1>
        {isNewProfile && (
          <p className="mt-2 text-sm text-gray-600">
            프로필을 저장하면 AI 지원 전략 기능이 정확해져요.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          {/*
            noValidate hands validation to handleSubmit: native constraint
            bubbles would otherwise suppress the submit event (blocking our JS
            checks) and are poorly announced by screen readers. We keep the
            min/max/step attributes on the number input for spinner UX.
          */}
          <form className="space-y-6" noValidate onSubmit={handleSubmit}>
            <div className="space-y-2">
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

            <div className="space-y-2">
              <Label htmlFor={YEARS_FIELD_ID}>경력 연차</Label>
              <Input
                id={YEARS_FIELD_ID}
                aria-describedby={yearsError ? YEARS_ERROR_ID : undefined}
                className="sm:max-w-40"
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
                <p className="text-xs text-red-400" id={YEARS_ERROR_ID}>
                  {yearsError}
                </p>
              )}
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-summary">경력 요약</Label>
                <span className="text-xs text-gray-500">
                  {form.summary.length} / {SUMMARY_MAX}
                </span>
              </div>
              <Textarea
                id="profile-summary"
                className="min-h-40"
                maxLength={SUMMARY_MAX}
                placeholder="경력, 강점, 주요 프로젝트 등을 자유롭게 작성해주세요."
                value={form.summary}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, summary: e.target.value }))
                }
              />
            </div>

            {saveSuccess && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>프로필을 저장했습니다.</AlertDescription>
              </Alert>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{saveError.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button disabled={isSaving} type="submit">
                <Save className="h-4 w-4" />
                {isSaving ? '저장 중…' : '프로필 저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
