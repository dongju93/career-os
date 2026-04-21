import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { extractJobPosting, saveJobPosting } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import type { JobPostingExtracted, Platform } from '../types/job-posting';

const PLATFORM_LABELS: Record<Platform, string> = {
  saramin: '사람인',
  wanted: '원티드',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  saramin: 'orange',
  wanted: 'teal',
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
    try {
      const data = await extractJobPosting(token, url.trim());
      setMeta({
        platform: data.platform,
        posting_id: data.posting_id,
        posting_url: data.posting_url,
      });
      setFormData(toFormState(data));
      setFormErrors({});
      setSaveError(null);
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

  if (savedInfo) {
    return (
      <Stack gap="xl">
        <Title order={2}>새 채용공고 등록</Title>
        <Card padding="xl" radius="xl" withBorder>
          <Stack align="center" gap="md" py="xl">
            <Text size="3xl">✅</Text>
            <Title order={3} ta="center">
              채용공고가 저장되었습니다
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {savedInfo.company_name} · {savedInfo.job_title}
            </Text>
            <Group mt="md">
              <Button
                radius="xl"
                variant="outline"
                onClick={() => navigate('/job-postings')}
              >
                목록으로 돌아가기
              </Button>
              <Button radius="xl" onClick={handleReset}>
                새 공고 등록
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>새 채용공고 등록</Title>
        <Text c="dimmed" mt={4} size="sm">
          URL을 입력하면 채용공고 정보를 자동으로 불러옵니다.
        </Text>
      </div>

      <Card padding="lg" radius="xl" withBorder>
        <Stack gap="md">
          <Text fw={600}>채용공고 URL</Text>
          <Group align="flex-end" gap="sm">
            <TextInput
              flex={1}
              disabled={isExtracting}
              placeholder="https://www.saramin.co.kr/... 또는 https://www.wanted.co.kr/..."
              radius="xl"
              size="md"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract();
              }}
            />
            <Button
              disabled={!url.trim() || isExtracting}
              loading={isExtracting}
              radius="xl"
              size="md"
              onClick={handleExtract}
            >
              불러오기
            </Button>
          </Group>
          {extractError && (
            <Alert
              color="red"
              radius="xl"
              title="불러오기 실패"
              variant="light"
            >
              {extractError}
            </Alert>
          )}
        </Stack>
      </Card>

      {formData && meta && (
        <Card padding="lg" radius="xl" withBorder>
          <Stack gap="xl">
            <Group gap="sm">
              <Badge
                color={PLATFORM_COLORS[meta.platform]}
                radius="xl"
                size="sm"
                variant="light"
              >
                {PLATFORM_LABELS[meta.platform]}
              </Badge>
              <Anchor
                c="dimmed"
                href={meta.posting_url}
                rel="noopener noreferrer"
                size="xs"
                target="_blank"
                className="truncate"
              >
                {meta.posting_url}
              </Anchor>
            </Group>

            <Stack gap="sm">
              <Divider label="기본 정보" labelPosition="left" />
              <TextInput
                required
                error={formErrors.company_name}
                label="회사명"
                radius="md"
                value={formData.company_name}
                onChange={(e) => patch({ company_name: e.target.value })}
              />
              <TextInput
                required
                error={formErrors.job_title}
                label="공고 제목"
                radius="md"
                value={formData.job_title}
                onChange={(e) => patch({ job_title: e.target.value })}
              />
            </Stack>

            <Stack gap="sm">
              <Divider label="근무 조건" labelPosition="left" />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="근무지"
                  radius="md"
                  value={formData.location}
                  onChange={(e) => patch({ location: e.target.value })}
                />
                <TextInput
                  label="경력"
                  radius="md"
                  value={formData.experience_req}
                  onChange={(e) => patch({ experience_req: e.target.value })}
                />
                <TextInput
                  label="고용 형태"
                  radius="md"
                  value={formData.employment_type}
                  onChange={(e) => patch({ employment_type: e.target.value })}
                />
                <TextInput
                  label="학력"
                  radius="md"
                  value={formData.education_req}
                  onChange={(e) => patch({ education_req: e.target.value })}
                />
                <TextInput
                  label="급여"
                  radius="md"
                  value={formData.salary}
                  onChange={(e) => patch({ salary: e.target.value })}
                />
                <TextInput
                  label="마감일"
                  radius="md"
                  value={formData.deadline}
                  onChange={(e) => patch({ deadline: e.target.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <Divider label="직무 내용" labelPosition="left" />
              <Textarea
                autosize
                label="업무 내용"
                minRows={2}
                radius="md"
                value={formData.job_description}
                onChange={(e) => patch({ job_description: e.target.value })}
              />
              <Textarea
                autosize
                label="담당 업무"
                minRows={2}
                radius="md"
                value={formData.responsibilities}
                onChange={(e) => patch({ responsibilities: e.target.value })}
              />
              <Textarea
                autosize
                label="자격 요건"
                minRows={2}
                radius="md"
                value={formData.qualifications}
                onChange={(e) => patch({ qualifications: e.target.value })}
              />
              <Textarea
                autosize
                label="우대 사항"
                minRows={2}
                radius="md"
                value={formData.preferred_points}
                onChange={(e) => patch({ preferred_points: e.target.value })}
              />
              <Textarea
                autosize
                label="복리 후생"
                minRows={2}
                radius="md"
                value={formData.benefits}
                onChange={(e) => patch({ benefits: e.target.value })}
              />
              <Textarea
                autosize
                label="채용 절차"
                minRows={2}
                radius="md"
                value={formData.hiring_process}
                onChange={(e) => patch({ hiring_process: e.target.value })}
              />
            </Stack>

            <Stack gap="sm">
              <Divider label="분류 및 태그" labelPosition="left" />
              <TagsInput
                label="기술 스택"
                radius="md"
                value={formData.tech_stack}
                onChange={(v) => patch({ tech_stack: v })}
              />
              <TagsInput
                label="태그"
                radius="md"
                value={formData.tags}
                onChange={(v) => patch({ tags: v })}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="직무 분류"
                  radius="md"
                  value={formData.job_category}
                  onChange={(e) => patch({ job_category: e.target.value })}
                />
                <TextInput
                  label="산업군"
                  radius="md"
                  value={formData.industry}
                  onChange={(e) => patch({ industry: e.target.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <Divider label="지원 정보" labelPosition="left" />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="지원 방법"
                  radius="md"
                  value={formData.application_method}
                  onChange={(e) =>
                    patch({ application_method: e.target.value })
                  }
                />
                <TextInput
                  label="지원 양식"
                  radius="md"
                  value={formData.application_form}
                  onChange={(e) => patch({ application_form: e.target.value })}
                />
                <TextInput
                  label="담당자"
                  radius="md"
                  value={formData.contact_person}
                  onChange={(e) => patch({ contact_person: e.target.value })}
                />
                <TextInput
                  label="홈페이지"
                  radius="md"
                  value={formData.homepage}
                  onChange={(e) => patch({ homepage: e.target.value })}
                />
              </SimpleGrid>
            </Stack>

            {saveError && (
              <Alert color="red" radius="xl" title="저장 실패" variant="light">
                {saveError}
              </Alert>
            )}

            <Group justify="flex-end" gap="sm">
              <Button
                disabled={isSaving}
                radius="xl"
                variant="subtle"
                onClick={() => navigate('/job-postings')}
              >
                취소
              </Button>
              <Button loading={isSaving} radius="xl" onClick={handleSave}>
                저장
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
