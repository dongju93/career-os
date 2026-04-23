import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  Save,
  Search,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { extractJobPosting, saveJobPosting } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import type { JobPostingExtracted, Platform } from '../types/job-posting';

interface FormState {
  company_name: string;
  job_title: string;
  location: string;
  experience_req: string;
  employment_type: string;
  education_req: string;
  salary: string;
  deadline: string;
  job_description: string;
  responsibilities: string;
  qualifications: string;
  preferred_points: string;
  benefits: string;
  hiring_process: string;
  tech_stack: string[];
  tags: string[];
  job_category: string;
  industry: string;
  application_method: string;
  application_form: string;
  contact_person: string;
  homepage: string;
}

interface ExtractedMeta {
  platform: Platform;
  posting_id: string;
  posting_url: string;
}

function toFormState(data: JobPostingExtracted): FormState {
  return {
    company_name: data.company_name,
    job_title: data.job_title,
    location: data.location ?? '',
    experience_req: data.experience_req ?? '',
    employment_type: data.employment_type ?? '',
    education_req: data.education_req ?? '',
    salary: data.salary ?? '',
    deadline: data.deadline ?? '',
    job_description: data.job_description ?? '',
    responsibilities: data.responsibilities ?? '',
    qualifications: data.qualifications ?? '',
    preferred_points: data.preferred_points ?? '',
    benefits: data.benefits ?? '',
    hiring_process: data.hiring_process ?? '',
    tech_stack: data.tech_stack ?? [],
    tags: data.tags ?? [],
    job_category: data.job_category ?? '',
    industry: data.industry ?? '',
    application_method: data.application_method ?? '',
    application_form: data.application_form ?? '',
    contact_person: data.contact_person ?? '',
    homepage: data.homepage ?? '',
  };
}

function toExtracted(
  form: FormState,
  meta: ExtractedMeta,
): JobPostingExtracted {
  const n = (s: string) => (s.trim() ? s.trim() : null);
  return {
    platform: meta.platform,
    posting_id: meta.posting_id,
    posting_url: meta.posting_url,
    company_name: form.company_name,
    job_title: form.job_title,
    location: n(form.location),
    experience_req: n(form.experience_req),
    employment_type: n(form.employment_type),
    education_req: n(form.education_req),
    salary: n(form.salary),
    deadline: n(form.deadline),
    job_description: n(form.job_description),
    responsibilities: n(form.responsibilities),
    qualifications: n(form.qualifications),
    preferred_points: n(form.preferred_points),
    benefits: n(form.benefits),
    hiring_process: n(form.hiring_process),
    tech_stack: form.tech_stack.length > 0 ? form.tech_stack : null,
    tags: form.tags.length > 0 ? form.tags : null,
    job_category: n(form.job_category),
    industry: n(form.industry),
    application_method: n(form.application_method),
    application_form: n(form.application_form),
    contact_person: n(form.contact_person),
    homepage: n(form.homepage),
  };
}

function FormSection({
  title,
  gridClass,
  children,
}: {
  title: string;
  gridClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-accent border px-3 py-1.5">
        <ChevronRight className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </h3>
      </div>
      <div className={gridClass ?? 'grid gap-4 grid-cols-1'}>{children}</div>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
  id,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ErrorDescription({ error }: { error: UserFacingError }) {
  return (
    <AlertDescription>
      <span className="block">{error.message}</span>
      <span className="mt-2 block font-mono text-xs font-semibold">
        {error.code}
      </span>
    </AlertDescription>
  );
}

export function AddJobPostingPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<UserFacingError | null>(
    null,
  );

  const [meta, setMeta] = useState<ExtractedMeta | null>(null);
  const [formData, setFormData] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<{
    company_name?: string;
    job_title?: string;
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<UserFacingError | null>(null);
  const [savedInfo, setSavedInfo] = useState<{
    company_name: string;
    job_title: string;
  } | null>(null);

  function patch(update: Partial<FormState>) {
    setFormData((prev) => (prev ? { ...prev, ...update } : prev));
  }

  async function handleExtract() {
    if (!token || !url.trim()) return;
    setIsExtracting(true);
    setExtractError(null);
    setSavedInfo(null);
    setMeta(null);
    setFormData(null);
    setFormErrors({});
    setSaveError(null);
    try {
      const data = await extractJobPosting(token, url.trim());
      setMeta({
        platform: data.platform,
        posting_id: data.posting_id,
        posting_url: data.posting_url,
      });
      setFormData(toFormState(data));
    } catch (err) {
      setExtractError(
        toUserFacingError(err, '채용공고 정보를 불러오지 못했습니다.'),
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function validate(): boolean {
    const errors: { company_name?: string; job_title?: string } = {};
    if (!formData?.company_name.trim())
      errors.company_name = '회사명을 입력해주세요.';
    if (!formData?.job_title.trim())
      errors.job_title = '공고 제목을 입력해주세요.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!token || !formData || !meta || !validate()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveJobPosting(token, toExtracted(formData, meta));
      setSavedInfo({
        company_name: formData.company_name,
        job_title: formData.job_title,
      });
    } catch (err) {
      setSaveError(toUserFacingError(err, '저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setUrl('');
    setExtractError(null);
    setMeta(null);
    setFormData(null);
    setFormErrors({});
    setSaveError(null);
    setSavedInfo(null);
  }

  /* ── Phase 3: Success ── */
  if (savedInfo) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            채용공고 등록
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            추출부터 저장까지 한 번에 완료했습니다.
          </p>
        </div>
        <Card className="animate-fade-in py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">저장 완료!</h3>
              <p className="mt-1 text-sm text-gray-600">
                채용공고가 성공적으로 저장되었습니다
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/job-postings">목록으로</Link>
              </Button>
              <Button onClick={handleReset}>
                <PlusCircle className="h-4 w-4" />
                다른 공고 등록
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in space-y-6">
      {/* Page header — transparent, floating on background */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            Capture Flow
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            채용공고 등록
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            URL을 입력해 공고를 추출한 뒤, 필요한 항목만 다듬어 저장합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="saramin">saramin</Badge>
          <Badge variant="wanted">wanted</Badge>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-gray-600 border">
            URL 기반 자동 추출
          </span>
        </div>
      </div>

      {/* URL Card — glass */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-white/8">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            채용공고 URL
          </CardTitle>
          <CardDescription>
            사람인 또는 원티드 채용공고 URL을 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-muted p-3 sm:flex-row">
            <Input
              className="flex-1"
              disabled={isExtracting}
              placeholder="https://www.saramin.co.kr/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract();
              }}
            />
            <Button
              className="sm:min-w-32"
              loading={isExtracting}
              onClick={handleExtract}
            >
              <Search className="h-4 w-4" />
              불러오기
            </Button>
          </div>

          {extractError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <ErrorDescription error={extractError} />
            </Alert>
          )}
        </CardContent>
      </Card>

      {formData && meta && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-white/8 bg-white/3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge
                  variant={meta.platform === 'saramin' ? 'saramin' : 'wanted'}
                >
                  {meta.platform}
                </Badge>
                <div>
                  <CardTitle>{formData.company_name}</CardTitle>
                  <CardDescription className="mt-0.5">
                    {formData.job_title}
                  </CardDescription>
                </div>
              </div>
              <a
                className="text-gray-600 hover:text-primary transition-colors"
                href={meta.posting_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 pt-6">
            <FormSection
              gridClass="grid gap-4 grid-cols-1 sm:grid-cols-2"
              title="기본 정보"
            >
              <FormField
                error={formErrors.company_name}
                id="company_name"
                label="회사명"
                required
              >
                <Input
                  id="company_name"
                  error={!!formErrors.company_name}
                  value={formData.company_name}
                  onChange={(e) => patch({ company_name: e.target.value })}
                />
              </FormField>
              <FormField
                error={formErrors.job_title}
                id="job_title"
                label="채용공고 제목"
                required
              >
                <Input
                  id="job_title"
                  error={!!formErrors.job_title}
                  value={formData.job_title}
                  onChange={(e) => patch({ job_title: e.target.value })}
                />
              </FormField>
            </FormSection>

            <FormSection
              gridClass="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              title="근무 조건"
            >
              <FormField id="location" label="근무지역">
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => patch({ location: e.target.value })}
                />
              </FormField>
              <FormField id="experience_req" label="경력">
                <Input
                  id="experience_req"
                  value={formData.experience_req}
                  onChange={(e) => patch({ experience_req: e.target.value })}
                />
              </FormField>
              <FormField id="employment_type" label="근무형태">
                <Input
                  id="employment_type"
                  value={formData.employment_type}
                  onChange={(e) => patch({ employment_type: e.target.value })}
                />
              </FormField>
              <FormField id="education_req" label="학력">
                <Input
                  id="education_req"
                  value={formData.education_req}
                  onChange={(e) => patch({ education_req: e.target.value })}
                />
              </FormField>
              <FormField id="salary" label="급여">
                <Input
                  id="salary"
                  value={formData.salary}
                  onChange={(e) => patch({ salary: e.target.value })}
                />
              </FormField>
              <FormField id="deadline" label="마감일">
                <Input
                  id="deadline"
                  value={formData.deadline}
                  onChange={(e) => patch({ deadline: e.target.value })}
                />
              </FormField>
            </FormSection>

            <FormSection title="직무 내용">
              <FormField id="job_description" label="업무 내용">
                <Textarea
                  id="job_description"
                  value={formData.job_description}
                  onChange={(e) => patch({ job_description: e.target.value })}
                />
              </FormField>
              <FormField id="responsibilities" label="담당업무">
                <Textarea
                  id="responsibilities"
                  value={formData.responsibilities}
                  onChange={(e) => patch({ responsibilities: e.target.value })}
                />
              </FormField>
              <FormField id="qualifications" label="자격요건">
                <Textarea
                  id="qualifications"
                  value={formData.qualifications}
                  onChange={(e) => patch({ qualifications: e.target.value })}
                />
              </FormField>
              <FormField id="preferred_points" label="우대사항">
                <Textarea
                  id="preferred_points"
                  value={formData.preferred_points}
                  onChange={(e) => patch({ preferred_points: e.target.value })}
                />
              </FormField>
            </FormSection>

            <FormSection title="분류 및 태그">
              <FormField id="tech_stack" label="기술 스택">
                <TagInput
                  id="tech_stack"
                  placeholder="기술명 입력 후 Enter"
                  value={formData.tech_stack}
                  onChange={(v) => patch({ tech_stack: v })}
                />
              </FormField>
              <FormField id="tags" label="태그">
                <TagInput
                  id="tags"
                  placeholder="태그 입력 후 Enter"
                  value={formData.tags}
                  onChange={(v) => patch({ tags: v })}
                />
              </FormField>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <FormField id="job_category" label="직군/직무">
                  <Input
                    id="job_category"
                    value={formData.job_category}
                    onChange={(e) => patch({ job_category: e.target.value })}
                  />
                </FormField>
                <FormField id="industry" label="산업군">
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => patch({ industry: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              gridClass="grid gap-4 grid-cols-1 sm:grid-cols-2"
              title="지원 정보"
            >
              <FormField id="benefits" label="복리후생">
                <Textarea
                  id="benefits"
                  value={formData.benefits}
                  onChange={(e) => patch({ benefits: e.target.value })}
                />
              </FormField>
              <FormField id="hiring_process" label="채용 절차">
                <Textarea
                  id="hiring_process"
                  value={formData.hiring_process}
                  onChange={(e) => patch({ hiring_process: e.target.value })}
                />
              </FormField>
              <FormField id="application_method" label="지원방법">
                <Input
                  id="application_method"
                  value={formData.application_method}
                  onChange={(e) =>
                    patch({ application_method: e.target.value })
                  }
                />
              </FormField>
              <FormField id="application_form" label="지원 양식">
                <Input
                  id="application_form"
                  value={formData.application_form}
                  onChange={(e) => patch({ application_form: e.target.value })}
                />
              </FormField>
              <FormField id="contact_person" label="담당자">
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => patch({ contact_person: e.target.value })}
                />
              </FormField>
              <FormField id="homepage" label="홈페이지">
                <Input
                  id="homepage"
                  value={formData.homepage}
                  onChange={(e) => patch({ homepage: e.target.value })}
                />
              </FormField>
            </FormSection>

            {saveError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>저장 실패</AlertTitle>
                <ErrorDescription error={saveError} />
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-3 border-t border-white/8 pt-6">
            <Button variant="outline" onClick={() => navigate('/job-postings')}>
              취소
            </Button>
            <Button loading={isSaving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              저장
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
