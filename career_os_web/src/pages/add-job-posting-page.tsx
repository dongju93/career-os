import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  PlusCircle,
  Save,
  Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
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
import { ApiError, toUserFacingError } from '../services/api-error';
import { extractJobPosting, saveJobPosting } from '../services/job-postings';
import { fetchJobSearchGroups } from '../services/job-search-groups';
import type { JobSearchGroupItem } from '../types/job-search-group';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedGroupId = searchParams.get('group') ?? undefined;

  const [url, setUrl] = useState('');
  const [pagePhase, setPagePhase] = useState<AddJobPostingPhase>(IDLE);
  const extractControllerRef = useRef<AbortController | null>(null);

  const [activeGroups, setActiveGroups] = useState<JobSearchGroupItem[]>([]);
  const [endedGroups, setEndedGroups] = useState<JobSearchGroupItem[]>([]);
  // '' = auto-resolve (backend picks current group); any UUID = explicit selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    preselectedGroupId ?? '',
  );
  const [noGroupError, setNoGroupError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchJobSearchGroups({ status: 'active', limit: 50 }, controller.signal),
      fetchJobSearchGroups({ status: 'ended', limit: 50 }, controller.signal),
    ])
      .then(([activeData, endedData]) => {
        setActiveGroups(activeData.items);
        setEndedGroups(endedData.items);
        if (preselectedGroupId) {
          const allGroups = [...activeData.items, ...endedData.items];
          const match = allGroups.find((g) => g.id === preselectedGroupId);
          if (!match && activeData.items.length > 0) {
            setSelectedGroupId('');
          }
        }
      })
      .catch(() => {
        // Non-critical: group selector degrades gracefully
      });
    return () => controller.abort();
  }, [preselectedGroupId]);

  async function handleExtract() {
    if (!url.trim()) return;

    extractControllerRef.current?.abort();
    const controller = new AbortController();
    extractControllerRef.current = controller;

    setNoGroupError(false);
    setPagePhase({ phase: 'extracting' });
    try {
      const data = await extractJobPosting(url.trim(), controller.signal);
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
    if (pagePhase.phase !== 'editing') return;
    const { meta, form } = pagePhase;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setPagePhase({ ...pagePhase, errors });
      return;
    }

    setNoGroupError(false);
    setPagePhase({ phase: 'saving', meta, form });
    try {
      await saveJobPosting(
        toExtracted(form, meta),
        selectedGroupId || undefined,
      );
      setPagePhase({
        phase: 'saved',
        company_name: form.company_name,
        job_title: form.job_title,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNoGroupError(true);
        setPagePhase({
          phase: 'editing',
          meta,
          form,
          errors: {},
          saveError: null,
        });
        return;
      }
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
    setNoGroupError(false);
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
  const showForm =
    pagePhase.phase === 'editing' || pagePhase.phase === 'saving';

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

      {showForm && (
        <Card className="overflow-hidden">
          <CardContent className="space-y-8 pt-6">
            {/* Group selector */}
            {(activeGroups.length > 0 || endedGroups.length > 0) && (
              <div className="space-y-2">
                <label
                  htmlFor="group-select"
                  className="text-sm font-medium text-foreground"
                >
                  저장할 구직 활동
                </label>
                <select
                  id="group-select"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={isSaving}
                >
                  <option value="">자동 선택 (현재 활동)</option>
                  {activeGroups.length > 0 && (
                    <optgroup label="진행 중인 구직 활동">
                      {activeGroups.map((group, index) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                          {index === 0 ? ' (현재)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {endedGroups.length > 0 && (
                    <optgroup label="지난 구직 활동">
                      {endedGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} (종료)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {noGroupError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>구직 활동 그룹이 없습니다</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    채용공고를 저장하려면 먼저 구직 활동 그룹을 만들어야 합니다.
                  </span>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="self-start"
                  >
                    <Link to="/job-search-groups">
                      <FolderOpen className="h-3.5 w-3.5" />
                      구직 활동 만들기
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

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
