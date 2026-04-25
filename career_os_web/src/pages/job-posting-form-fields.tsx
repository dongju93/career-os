import { AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { toSafeExternalUrl } from '../utils/url';
import type {
  JobPostingExtractedMeta,
  JobPostingFormErrors,
  JobPostingFormState,
} from './job-posting-form-state';

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

interface JobPostingFormFieldsProps {
  meta: JobPostingExtractedMeta;
  form: JobPostingFormState;
  errors: JobPostingFormErrors;
  saveError: string | null;
  onPatch: (update: Partial<JobPostingFormState>) => void;
}

export function JobPostingFormFields({
  meta,
  form,
  errors,
  saveError,
  onPatch,
}: JobPostingFormFieldsProps) {
  const safePostingUrl = toSafeExternalUrl(meta.posting_url);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={meta.platform === 'saramin' ? 'saramin' : 'wanted'}>
            {meta.platform}
          </Badge>
          <div>
            <p className="font-semibold leading-none">{form.company_name}</p>
            <p className="mt-0.5 text-sm text-gray-600">{form.job_title}</p>
          </div>
        </div>
        {safePostingUrl && (
          <a
            className="text-gray-600 hover:text-primary transition-colors"
            href={safePostingUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <FormSection
        gridClass="grid gap-4 grid-cols-1 sm:grid-cols-2"
        title="기본 정보"
      >
        <FormField
          error={errors.company_name}
          id="company_name"
          label="회사명"
          required
        >
          <Input
            id="company_name"
            error={!!errors.company_name}
            value={form.company_name}
            onChange={(e) => onPatch({ company_name: e.target.value })}
          />
        </FormField>
        <FormField
          error={errors.job_title}
          id="job_title"
          label="채용공고 제목"
          required
        >
          <Input
            id="job_title"
            error={!!errors.job_title}
            value={form.job_title}
            onChange={(e) => onPatch({ job_title: e.target.value })}
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
            value={form.location}
            onChange={(e) => onPatch({ location: e.target.value })}
          />
        </FormField>
        <FormField id="experience_req" label="경력">
          <Input
            id="experience_req"
            value={form.experience_req}
            onChange={(e) => onPatch({ experience_req: e.target.value })}
          />
        </FormField>
        <FormField id="employment_type" label="근무형태">
          <Input
            id="employment_type"
            value={form.employment_type}
            onChange={(e) => onPatch({ employment_type: e.target.value })}
          />
        </FormField>
        <FormField id="education_req" label="학력">
          <Input
            id="education_req"
            value={form.education_req}
            onChange={(e) => onPatch({ education_req: e.target.value })}
          />
        </FormField>
        <FormField id="salary" label="급여">
          <Input
            id="salary"
            value={form.salary}
            onChange={(e) => onPatch({ salary: e.target.value })}
          />
        </FormField>
        <FormField id="deadline" label="마감일">
          <Input
            id="deadline"
            value={form.deadline}
            onChange={(e) => onPatch({ deadline: e.target.value })}
          />
        </FormField>
      </FormSection>

      <FormSection title="직무 내용">
        <FormField id="job_description" label="업무 내용">
          <Textarea
            id="job_description"
            value={form.job_description}
            onChange={(e) => onPatch({ job_description: e.target.value })}
          />
        </FormField>
        <FormField id="responsibilities" label="담당업무">
          <Textarea
            id="responsibilities"
            value={form.responsibilities}
            onChange={(e) => onPatch({ responsibilities: e.target.value })}
          />
        </FormField>
        <FormField id="qualifications" label="자격요건">
          <Textarea
            id="qualifications"
            value={form.qualifications}
            onChange={(e) => onPatch({ qualifications: e.target.value })}
          />
        </FormField>
        <FormField id="preferred_points" label="우대사항">
          <Textarea
            id="preferred_points"
            value={form.preferred_points}
            onChange={(e) => onPatch({ preferred_points: e.target.value })}
          />
        </FormField>
      </FormSection>

      <FormSection title="분류 및 태그">
        <FormField id="tech_stack" label="기술 스택">
          <TagInput
            id="tech_stack"
            placeholder="기술명 입력 후 Enter"
            value={form.tech_stack}
            onChange={(v) => onPatch({ tech_stack: v })}
          />
        </FormField>
        <FormField id="tags" label="태그">
          <TagInput
            id="tags"
            placeholder="태그 입력 후 Enter"
            value={form.tags}
            onChange={(v) => onPatch({ tags: v })}
          />
        </FormField>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <FormField id="job_category" label="직군/직무">
            <Input
              id="job_category"
              value={form.job_category}
              onChange={(e) => onPatch({ job_category: e.target.value })}
            />
          </FormField>
          <FormField id="industry" label="산업군">
            <Input
              id="industry"
              value={form.industry}
              onChange={(e) => onPatch({ industry: e.target.value })}
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
            value={form.benefits}
            onChange={(e) => onPatch({ benefits: e.target.value })}
          />
        </FormField>
        <FormField id="hiring_process" label="채용 절차">
          <Textarea
            id="hiring_process"
            value={form.hiring_process}
            onChange={(e) => onPatch({ hiring_process: e.target.value })}
          />
        </FormField>
        <FormField id="application_method" label="지원방법">
          <Input
            id="application_method"
            value={form.application_method}
            onChange={(e) => onPatch({ application_method: e.target.value })}
          />
        </FormField>
        <FormField id="application_form" label="지원 양식">
          <Input
            id="application_form"
            value={form.application_form}
            onChange={(e) => onPatch({ application_form: e.target.value })}
          />
        </FormField>
        <FormField id="contact_person" label="담당자">
          <Input
            id="contact_person"
            value={form.contact_person}
            onChange={(e) => onPatch({ contact_person: e.target.value })}
          />
        </FormField>
        <FormField id="homepage" label="홈페이지">
          <Input
            id="homepage"
            value={form.homepage}
            onChange={(e) => onPatch({ homepage: e.target.value })}
          />
        </FormField>
      </FormSection>

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>저장 실패</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
