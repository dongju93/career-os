import * as stylex from '@stylexjs/stylex';
import { AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { cloneElement, isValidElement, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import type { AppStyles } from '@/lib/styles';
import { toSafeExternalUrl } from '../utils/url';
import type {
  JobPostingExtractedMeta,
  JobPostingFormErrors,
  JobPostingFormState,
} from './job-posting-form-state';

function FormSection({
  title,
  gridStyle,
  children,
}: {
  title: string;
  gridStyle?: AppStyles;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.formSectionStack)} data-stack="">
      <div {...stylex.props(styles.formSectionContainer)}>
        <ChevronRight {...stylex.props(styles.formSectionChevronRight)} />
        <h3 {...stylex.props(styles.formSectionHeading)}>{title}</h3>
      </div>
      <div {...stylex.props(gridStyle ?? styles.formSectionGrid)}>
        {children}
      </div>
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
  // Only link a description when there is both a field id and an error to point
  // at; otherwise the control keeps its default (undescribed) accessible name.
  const errorId = id && error ? `${id}-error` : undefined;
  const control =
    errorId && isValidElement<{ 'aria-describedby'?: string }>(children)
      ? cloneElement(children, { 'aria-describedby': errorId })
      : children;

  return (
    <div {...stylex.props(styles.formFieldStack)} data-stack="">
      <Label htmlFor={id}>
        {label}
        {required && <span {...stylex.props(styles.formFieldText)}>*</span>}
      </Label>
      {control}
      {error && (
        <p {...stylex.props(styles.formFieldDescription)} id={errorId}>
          {error}
        </p>
      )}
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
      <div {...stylex.props(styles.jobPostingFormFieldsRow)}>
        <div {...stylex.props(styles.jobPostingFormFieldsRow2)}>
          <Badge variant={meta.platform === 'saramin' ? 'saramin' : 'wanted'}>
            {meta.platform}
          </Badge>
          <div>
            <p {...stylex.props(styles.jobPostingFormFieldsDescription)}>
              {form.company_name}
            </p>
            <p {...stylex.props(styles.jobPostingFormFieldsDescription2)}>
              {form.job_title}
            </p>
          </div>
        </div>
        {safePostingUrl && (
          <a
            {...stylex.props(styles.jobPostingFormFieldsLink)}
            href={safePostingUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink
              {...stylex.props(styles.jobPostingFormFieldsExternalLink)}
            />
          </a>
        )}
      </div>

      <FormSection
        gridStyle={styles.jobPostingFormFieldsFormSection}
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
        gridStyle={styles.jobPostingFormFieldsFormSection2}
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
        <div {...stylex.props(styles.jobPostingFormFieldsFormSection)}>
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
        gridStyle={styles.jobPostingFormFieldsFormSection}
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
        <Alert
          icon={
            <AlertCircle
              {...stylex.props(styles.jobPostingFormFieldsExternalLink)}
            />
          }
          variant="destructive"
        >
          <AlertTitle>저장 실패</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

const styles = stylex.create({
  formSectionStack: {
    '--stack-space': '1rem',
  },
  formSectionContainer: {
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
  formSectionChevronRight: {
    height: '1rem',
    width: '1rem',
    color: 'hsl(var(--primary))',
  },
  formSectionHeading: {
    fontSize: '.75rem',
    lineHeight: 1.25,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '-.02em',
    color: 'oklch(44.6% .03 256.802)',
  },
  formSectionGrid: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
  },
  formFieldStack: {
    '--stack-space': '0.375rem',
  },
  formFieldText: {
    color: 'oklch(70.4% .191 22.216)',
    marginLeft: '0.125rem',
  },
  formFieldDescription: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(70.4% .191 22.216)',
  },
  jobPostingFormFieldsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobPostingFormFieldsRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  jobPostingFormFieldsDescription: {
    fontWeight: 600,
    lineHeight: 1,
  },
  jobPostingFormFieldsDescription2: {
    marginTop: '0.125rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingFormFieldsLink: {
    color: {
      default: 'oklch(44.6% .03 256.802)',
      ':hover': 'hsl(var(--primary))',
    },
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  jobPostingFormFieldsExternalLink: {
    height: '1rem',
    width: '1rem',
  },
  jobPostingFormFieldsFormSection: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: {
      default: 'repeat(1, minmax(0, 1fr))',
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  jobPostingFormFieldsFormSection2: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: {
      default: 'repeat(1, minmax(0, 1fr))',
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 64rem)': 'repeat(3, minmax(0, 1fr))',
    },
  },
});
