import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { extractJobPosting, saveJobPosting } from '@/services/job-postings';
import { useAuthStore } from '@/store/auth-store';
import type { JobPostingExtracted, Platform } from '@/types/job-posting';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const PLATFORM_LABELS: Record<Platform, string> = {
  saramin: '사람인',
  wanted: '원티드',
};

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

function toExtracted(form: FormState, meta: ExtractedMeta): JobPostingExtracted {
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

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeTag(tagToRemove: string) {
    onChange(value.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-white/70 backdrop-blur-sm min-h-[44px] focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-1 rounded-full hover:bg-muted p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChevronRight className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className={cn(error && 'text-destructive')}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AddJobPostingPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [meta, setMeta] = useState<ExtractedMeta | null>(null);
  const [formData, setFormData] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<{
    company_name?: string;
    job_title?: string;
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
        err instanceof Error
          ? err.message
          : '채용공고 정보를 불러오지 못했습니다.',
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
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
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

  // Success State
  if (savedInfo) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">채용공고가 저장되었습니다</h3>
            <p className="text-muted-foreground mb-1">{savedInfo.company_name}</p>
            <p className="text-sm text-muted-foreground mb-8">
              {savedInfo.job_title}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/job-postings')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로 돌아가기
              </Button>
              <Button onClick={handleReset}>
                <Plus className="h-4 w-4 mr-2" />
                새 공고 등록
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          새 채용공고 등록
        </h1>
        <p className="text-muted-foreground mt-1">
          URL을 입력하면 채용공고 정보를 자동으로 불러옵니다.
        </p>
      </div>

      {/* URL Input Card */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            채용공고 URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              disabled={isExtracting}
              placeholder="https://www.saramin.co.kr/... 또는 https://www.wanted.co.kr/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract();
              }}
              className="flex-1"
            />
            <Button
              disabled={!url.trim() || isExtracting}
              onClick={handleExtract}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  불러오는 중
                </>
              ) : (
                '불러오기'
              )}
            </Button>
          </div>
          {extractError && (
            <Alert variant="destructive">
              <AlertTitle>불러오기 실패</AlertTitle>
              <AlertDescription>{extractError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Form Card */}
      {formData && meta && (
        <Card className="glass-card overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-teal-500/5 border-b">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant={meta.platform === 'saramin' ? 'saramin' : 'wanted'}
                >
                  {PLATFORM_LABELS[meta.platform]}
                </Badge>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {formData.company_name || '회사명'}
                  </span>
                </div>
              </div>
              <a
                href={meta.posting_url}
                rel="noopener noreferrer"
                target="_blank"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                원본 공고 보기
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* Basic Info */}
            <FormSection title="기본 정보">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  label="회사명"
                  required
                  error={formErrors.company_name}
                >
                  <Input
                    value={formData.company_name}
                    onChange={(e) => patch({ company_name: e.target.value })}
                    error={!!formErrors.company_name}
                  />
                </FormField>
                <FormField
                  label="공고 제목"
                  required
                  error={formErrors.job_title}
                >
                  <Input
                    value={formData.job_title}
                    onChange={(e) => patch({ job_title: e.target.value })}
                    error={!!formErrors.job_title}
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Working Conditions */}
            <FormSection title="근무 조건">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="근무지">
                  <Input
                    value={formData.location}
                    onChange={(e) => patch({ location: e.target.value })}
                  />
                </FormField>
                <FormField label="경력">
                  <Input
                    value={formData.experience_req}
                    onChange={(e) => patch({ experience_req: e.target.value })}
                  />
                </FormField>
                <FormField label="고용 형태">
                  <Input
                    value={formData.employment_type}
                    onChange={(e) => patch({ employment_type: e.target.value })}
                  />
                </FormField>
                <FormField label="학력">
                  <Input
                    value={formData.education_req}
                    onChange={(e) => patch({ education_req: e.target.value })}
                  />
                </FormField>
                <FormField label="급여">
                  <Input
                    value={formData.salary}
                    onChange={(e) => patch({ salary: e.target.value })}
                  />
                </FormField>
                <FormField label="마감일">
                  <Input
                    value={formData.deadline}
                    onChange={(e) => patch({ deadline: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Job Description */}
            <FormSection title="직무 내용">
              <FormField label="업무 내용">
                <Textarea
                  value={formData.job_description}
                  onChange={(e) => patch({ job_description: e.target.value })}
                  rows={3}
                />
              </FormField>
              <FormField label="담당 업무">
                <Textarea
                  value={formData.responsibilities}
                  onChange={(e) => patch({ responsibilities: e.target.value })}
                  rows={3}
                />
              </FormField>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="자격 요건">
                  <Textarea
                    value={formData.qualifications}
                    onChange={(e) => patch({ qualifications: e.target.value })}
                    rows={3}
                  />
                </FormField>
                <FormField label="우대 사항">
                  <Textarea
                    value={formData.preferred_points}
                    onChange={(e) => patch({ preferred_points: e.target.value })}
                    rows={3}
                  />
                </FormField>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="복리 후생">
                  <Textarea
                    value={formData.benefits}
                    onChange={(e) => patch({ benefits: e.target.value })}
                    rows={3}
                  />
                </FormField>
                <FormField label="채용 절차">
                  <Textarea
                    value={formData.hiring_process}
                    onChange={(e) => patch({ hiring_process: e.target.value })}
                    rows={3}
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Tags */}
            <FormSection title="분류 및 태그">
              <FormField label="기술 스택">
                <TagInput
                  value={formData.tech_stack}
                  onChange={(v) => patch({ tech_stack: v })}
                  placeholder="기술 스택을 입력하고 Enter"
                />
              </FormField>
              <FormField label="태그">
                <TagInput
                  value={formData.tags}
                  onChange={(v) => patch({ tags: v })}
                  placeholder="태그를 입력하고 Enter"
                />
              </FormField>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="직무 분류">
                  <Input
                    value={formData.job_category}
                    onChange={(e) => patch({ job_category: e.target.value })}
                  />
                </FormField>
                <FormField label="산업군">
                  <Input
                    value={formData.industry}
                    onChange={(e) => patch({ industry: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Application Info */}
            <FormSection title="지원 정보">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="지원 방법">
                  <Input
                    value={formData.application_method}
                    onChange={(e) =>
                      patch({ application_method: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="지원 양식">
                  <Input
                    value={formData.application_form}
                    onChange={(e) => patch({ application_form: e.target.value })}
                  />
                </FormField>
                <FormField label="담당자">
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => patch({ contact_person: e.target.value })}
                  />
                </FormField>
                <FormField label="홈페이지">
                  <Input
                    value={formData.homepage}
                    onChange={(e) => patch({ homepage: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Save Error */}
            {saveError && (
              <Alert variant="destructive">
                <AlertTitle>저장 실패</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/job-postings')}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 중
                  </>
                ) : (
                  '저장'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
