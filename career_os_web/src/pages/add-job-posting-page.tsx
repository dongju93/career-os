import * as stylex from '@stylexjs/stylex';
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
import { LiveRegion } from '@/components/ui/live-region';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { ApiError, toUserFacingError } from '../services/api-error';
import { extractJobPosting, saveJobPosting } from '../services/job-postings';
import { fetchJobSearchGroups } from '../services/job-search-groups';
import type { JobSearchGroupItem } from '../types/job-search-group';
import { JobPostingFormFields } from './job-posting-form-fields';
import {
  type AddJobPostingPhase,
  type JobPostingFormErrors,
  type JobPostingFormState,
  toExtracted,
  toFormState,
  validateForm,
} from './job-posting-form-state';

const IDLE: AddJobPostingPhase = { phase: 'idle' };

// Focus order for the first-error jump; ids match the field ids in
// JobPostingFormFields so getElementById resolves the real control.
const ERROR_FIELD_ORDER: (keyof JobPostingFormErrors)[] = [
  'company_name',
  'job_title',
];

function focusFirstError(errors: JobPostingFormErrors) {
  const firstErrorField = ERROR_FIELD_ORDER.find((field) => errors[field]);
  if (!firstErrorField) return;
  // Defer to the next frame so the invalid state (and its aria-describedby)
  // is committed before the screen reader reads the focused control.
  requestAnimationFrame(() => {
    document.getElementById(firstErrorField)?.focus();
  });
}

export function AddJobPostingPage() {
  useDocumentTitle('채용공고 등록');
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
      focusFirstError(errors);
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
      <div
        {...stylex.props([styles.addJobPostingPageStack, motion.fadeIn])}
        data-stack=""
      >
        <LiveRegion politeness="polite">채용공고를 저장했습니다.</LiveRegion>
        <div>
          <h1 {...stylex.props(styles.addJobPostingPageHeading)}>
            채용공고 등록
          </h1>
          <p {...stylex.props(styles.addJobPostingPageDescription)}>
            추출부터 저장까지 한 번에 완료했습니다.
          </p>
        </div>
        <Card xstyle={[styles.addJobPostingPageCard, motion.fadeIn]}>
          <CardContent xstyle={styles.addJobPostingPageCardContent}>
            <div {...stylex.props(styles.addJobPostingPageRow)}>
              <CheckCircle2
                {...stylex.props(styles.addJobPostingPageCheckCircle2)}
              />
            </div>
            <div>
              <h3 {...stylex.props(styles.addJobPostingPageHeading2)}>
                저장 완료!
              </h3>
              <p {...stylex.props(styles.addJobPostingPageDescription)}>
                채용공고가 성공적으로 저장되었습니다
              </p>
            </div>
            <div {...stylex.props(styles.addJobPostingPageRow2)}>
              <Button asChild variant="outline">
                <Link to="/job-postings">목록으로</Link>
              </Button>
              <Button onClick={handleReset}>
                <PlusCircle
                  {...stylex.props(styles.addJobPostingPagePlusCircle)}
                />
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
    <div
      {...stylex.props([styles.addJobPostingPageStack, motion.fadeIn])}
      data-stack=""
    >
      <LiveRegion politeness="polite">
        {isExtracting
          ? '채용공고를 불러오는 중입니다…'
          : isSaving
            ? '채용공고를 저장하는 중입니다…'
            : ''}
      </LiveRegion>
      <div {...stylex.props(styles.addJobPostingPageRow3)}>
        <div>
          <p {...stylex.props(styles.addJobPostingPageDescription2)}>
            Capture Flow
          </p>
          <h1 {...stylex.props(styles.addJobPostingPageHeading)}>
            채용공고 등록
          </h1>
          <p {...stylex.props(styles.addJobPostingPageDescription)}>
            URL을 입력해 공고를 추출한 뒤, 필요한 항목만 다듬어 저장합니다.
          </p>
        </div>
        <div {...stylex.props(styles.addJobPostingPageRow4)}>
          <Badge variant="saramin">saramin</Badge>
          <Badge variant="wanted">wanted</Badge>
          <span {...stylex.props(styles.addJobPostingPageText)}>
            URL 기반 자동 추출
          </span>
        </div>
      </div>

      <Card xstyle={styles.addJobPostingPageCard2}>
        <CardHeader xstyle={styles.addJobPostingPageCardHeader}>
          <CardTitle xstyle={styles.addJobPostingPageCardTitle}>
            <Search {...stylex.props(styles.addJobPostingPageSearch)} />
            채용공고 URL
          </CardTitle>
          <CardDescription>
            사람인 또는 원티드 채용공고 URL을 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent
          xstyle={styles.addJobPostingPageCardContent2}
          data-stack=""
        >
          <div {...stylex.props(styles.addJobPostingPageRow5)}>
            <Input
              xstyle={styles.addJobPostingPageInput}
              disabled={isExtracting}
              placeholder="https://www.saramin.co.kr/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract();
              }}
            />
            <Button
              xstyle={styles.addJobPostingPageButton}
              loading={isExtracting}
              onClick={handleExtract}
            >
              <Search {...stylex.props(styles.addJobPostingPagePlusCircle)} />
              불러오기
            </Button>
          </div>

          {pagePhase.phase === 'extractError' && (
            <Alert
              icon={
                <AlertCircle
                  {...stylex.props(styles.addJobPostingPagePlusCircle)}
                />
              }
              variant="destructive"
            >
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>
                <span {...stylex.props(styles.addJobPostingPageText2)}>
                  {pagePhase.message}
                </span>
                <span {...stylex.props(styles.addJobPostingPageText3)}>
                  {pagePhase.code}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <Card xstyle={styles.addJobPostingPageCard2}>
          <CardContent
            xstyle={styles.addJobPostingPageCardContent3}
            data-stack=""
          >
            {/* Group selector */}
            {(activeGroups.length > 0 || endedGroups.length > 0) && (
              <div
                {...stylex.props(styles.addJobPostingPageStack2)}
                data-stack=""
              >
                <label
                  htmlFor="group-select"
                  {...stylex.props(styles.addJobPostingPageLabel)}
                >
                  저장할 구직 활동
                </label>
                <select
                  id="group-select"
                  {...stylex.props(styles.addJobPostingPageSelect)}
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
              <Alert
                icon={
                  <AlertCircle
                    {...stylex.props(styles.addJobPostingPagePlusCircle)}
                  />
                }
                variant="destructive"
              >
                <AlertTitle>구직 활동 그룹이 없습니다</AlertTitle>
                <AlertDescription
                  xstyle={styles.addJobPostingPageAlertDescription}
                >
                  <span>
                    채용공고를 저장하려면 먼저 구직 활동 그룹을 만들어야 합니다.
                  </span>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    xstyle={styles.addJobPostingPageButton2}
                  >
                    <Link to="/job-search-groups">
                      <FolderOpen
                        {...stylex.props(styles.addJobPostingPageFolderOpen)}
                      />
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

          <CardFooter xstyle={styles.addJobPostingPageCardFooter}>
            <Button variant="outline" onClick={() => navigate('/job-postings')}>
              취소
            </Button>
            <Button loading={isSaving} onClick={handleSave}>
              <Save {...stylex.props(styles.addJobPostingPagePlusCircle)} />
              저장
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

const styles = stylex.create({
  addJobPostingPageStack: {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '56rem',
    '--stack-space': '1.5rem',
  },
  addJobPostingPageHeading: {
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 40rem)': '1.875rem',
    },
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  addJobPostingPageDescription: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  addJobPostingPageCard: {
    paddingTop: '3rem',
    paddingBottom: '3rem',
    textAlign: 'center',
  },
  addJobPostingPageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '0rem',
    paddingBottom: '0rem',
  },
  addJobPostingPageRow: {
    display: 'flex',
    height: '4rem',
    width: '4rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, oklch(76.5% .177 163.223) 10%, transparent)',
    color: 'oklch(76.5% .177 163.223)',
    borderWidth: '1px',
    borderColor:
      'color-mix(in oklab, oklch(76.5% .177 163.223) 20%, transparent)',
  },
  addJobPostingPageCheckCircle2: {
    height: '1.75rem',
    width: '1.75rem',
  },
  addJobPostingPageHeading2: {
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
  },
  addJobPostingPageRow2: {
    display: 'flex',
    gap: '0.75rem',
  },
  addJobPostingPagePlusCircle: {
    height: '1rem',
    width: '1rem',
  },
  addJobPostingPageRow3: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 64rem)': 'row',
    },
    gap: '1rem',
    alignItems: {
      default: null,
      '@media (min-width: 64rem)': 'flex-end',
    },
    justifyContent: {
      default: null,
      '@media (min-width: 64rem)': 'space-between',
    },
  },
  addJobPostingPageDescription2: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  addJobPostingPageRow4: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  addJobPostingPageText: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    backgroundColor: 'hsl(var(--muted))',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.25rem',
    paddingBottom: '0.25rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
    color: 'oklch(44.6% .03 256.802)',
    borderWidth: '1px',
  },
  addJobPostingPageCard2: {
    overflow: 'hidden',
  },
  addJobPostingPageCardHeader: {
    borderBottomWidth: '1px',
    borderColor: 'color-mix(in oklab, #fff 8%, transparent)',
  },
  addJobPostingPageCardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  addJobPostingPageSearch: {
    height: '1.25rem',
    width: '1.25rem',
    color: 'hsl(var(--primary))',
  },
  addJobPostingPageCardContent2: {
    '--stack-space': '1rem',
  },
  addJobPostingPageRow5: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: '0.75rem',
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, #fff 8%, transparent)',
    backgroundColor: 'hsl(var(--muted))',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
  },
  addJobPostingPageInput: {
    flex: '1',
  },
  addJobPostingPageButton: {
    minWidth: {
      default: null,
      '@media (min-width: 40rem)': '8rem',
    },
  },
  addJobPostingPageText2: {
    display: 'block',
  },
  addJobPostingPageText3: {
    marginTop: '0.5rem',
    display: 'block',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
  },
  addJobPostingPageCardContent3: {
    '--stack-space': '2rem',
    paddingTop: '1.5rem',
  },
  addJobPostingPageStack2: {
    '--stack-space': '0.5rem',
  },
  addJobPostingPageLabel: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: 'hsl(var(--foreground))',
  },
  addJobPostingPageSelect: {
    width: '100%',
    borderRadius: '.75rem',
    borderWidth: '1px',
    backgroundColor: 'hsl(var(--background))',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color: 'hsl(var(--foreground))',
    outlineStyle: {
      default: null,
      ':focus': 'solid',
    },
    outlineWidth: {
      default: null,
      ':focus': '2px',
    },
    outlineColor: {
      default: null,
      ':focus': 'color-mix(in oklab, hsl(var(--primary)) 50%, transparent)',
    },
    outlineOffset: {
      default: null,
      ':focus': '0px',
    },
  },
  addJobPostingPageAlertDescription: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  addJobPostingPageButton2: {
    alignSelf: 'flex-start',
  },
  addJobPostingPageFolderOpen: {
    height: '0.875rem',
    width: '0.875rem',
  },
  addJobPostingPageCardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    borderTopWidth: '1px',
    borderColor: 'color-mix(in oklab, #fff 8%, transparent)',
    paddingTop: '1.5rem',
  },
});
