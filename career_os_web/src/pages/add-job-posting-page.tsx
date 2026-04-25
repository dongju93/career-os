import {
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Save,
  Search,
} from 'lucide-react';
import { useRef, useState } from 'react';
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
import { toUserFacingError } from '../services/api-error';
import { extractJobPosting, saveJobPosting } from '../services/job-postings';
import { useAuthStore } from '../store/auth-store';
import { JobPostingFormFields } from './job-posting-form-fields';
import {
  type AddJobPostingPhase,
  type JobPostingFormState,
  toExtracted,
  toFormState,
  validateForm,
} from './job-posting-form-state';

const IDLE: AddJobPostingPhase = { phase: 'idle' };

export function AddJobPostingPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [pagePhase, setPagePhase] = useState<AddJobPostingPhase>(IDLE);
  const extractControllerRef = useRef<AbortController | null>(null);

  async function handleExtract() {
    if (!token || !url.trim()) return;

    extractControllerRef.current?.abort();
    const controller = new AbortController();
    extractControllerRef.current = controller;

    setPagePhase({ phase: 'extracting' });
    try {
      const data = await extractJobPosting(
        token,
        url.trim(),
        controller.signal,
      );
      setPagePhase({
        phase: 'editing',
        meta: {
          platform: data.platform,
          posting_id: data.posting_id,
          posting_url: data.posting_url,
        },
        form: toFormState(data),
        errors: {},
        saveError: null,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setPagePhase(IDLE);
        return;
      }
      const { message, code } = toUserFacingError(
        err,
        '채용공고 정보를 불러오지 못했습니다.',
      );
      setPagePhase({ phase: 'extractError', message, code });
    }
  }

  function handlePatch(update: Partial<JobPostingFormState>) {
    setPagePhase((prev) => {
      if (prev.phase !== 'editing') return prev;
      return { ...prev, form: { ...prev.form, ...update } };
    });
  }

  async function handleSave() {
    if (!token || pagePhase.phase !== 'editing') return;
    const { meta, form } = pagePhase;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setPagePhase({ ...pagePhase, errors });
      return;
    }

    setPagePhase({ phase: 'saving', meta, form });
    try {
      await saveJobPosting(token, toExtracted(form, meta));
      setPagePhase({
        phase: 'saved',
        company_name: form.company_name,
        job_title: form.job_title,
      });
    } catch (err) {
      const { message } = toUserFacingError(err, '저장에 실패했습니다.');
      setPagePhase({
        phase: 'editing',
        meta,
        form,
        errors: {},
        saveError: message,
      });
    }
  }

  function handleReset() {
    setUrl('');
    setPagePhase(IDLE);
  }

  if (pagePhase.phase === 'saved') {
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

  const isExtracting = pagePhase.phase === 'extracting';
  const isSaving = pagePhase.phase === 'saving';

  return (
    <div className="mx-auto max-w-4xl animate-fade-in space-y-6">
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

          {pagePhase.phase === 'extractError' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>
                <span className="block">{pagePhase.message}</span>
                <span className="mt-2 block font-mono text-xs font-semibold">
                  {pagePhase.code}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {(pagePhase.phase === 'editing' || pagePhase.phase === 'saving') && (
        <Card className="overflow-hidden">
          <CardContent className="space-y-8 pt-6">
            <JobPostingFormFields
              meta={pagePhase.meta}
              form={pagePhase.form}
              errors={pagePhase.phase === 'editing' ? pagePhase.errors : {}}
              saveError={
                pagePhase.phase === 'editing' ? pagePhase.saveError : null
              }
              onPatch={handlePatch}
            />
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
