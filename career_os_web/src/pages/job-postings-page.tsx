import * as stylex from '@stylexjs/stylex';
import {
  AlertCircle,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  MapPin,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { surfaces } from '@/styles/surfaces';
import { toUserFacingError, type UserFacingError } from '../services/api-error';
import { fetchJobPostings } from '../services/job-postings';
import { fetchJobSearchGroups } from '../services/job-search-groups';
import type { JobPostingListItem } from '../types/job-posting';
import type { JobSearchGroupItem } from '../types/job-search-group';
import {
  APPLICATION_STATUS_LABELS,
  applicationStatusAccentStyle,
  applicationStatusVariant,
  formatRelativeDate,
  platformVariant,
} from '../utils/job-posting-formatters';
import { toSafeExternalUrl } from '../utils/url';

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div {...stylex.props(styles.summaryChipContainer)}>
      <p {...stylex.props(styles.summaryChipDescription)}>{label}</p>
      <p {...stylex.props(styles.summaryChipDescription2)}>{value}</p>
    </div>
  );
}

function JobPostingCard({ item }: { item: JobPostingListItem }) {
  const hasDetails = Boolean(
    item.location || item.experience_req || item.deadline || item.salary,
  );
  const safePostingUrl = toSafeExternalUrl(item.posting_url);

  return (
    <Card
      xstyle={[
        styles.jobPostingCardCard,
        stylex.defaultMarker(),
        surfaces.glassHover,
      ]}
    >
      <div
        aria-hidden="true"
        {...stylex.props([
          styles.jobPostingCardContainer,
          applicationStatusAccentStyle(item.application_status),
        ])}
      />
      <CardContent xstyle={styles.jobPostingCardCardContent}>
        <div {...stylex.props(styles.jobPostingCardRow)}>
          <div {...stylex.props(styles.jobPostingCardRow2)}>
            <Badge variant={platformVariant(item.platform)}>
              {item.platform}
            </Badge>
            <Badge variant={applicationStatusVariant(item.application_status)}>
              {APPLICATION_STATUS_LABELS[item.application_status]}
            </Badge>
          </div>
          <div {...stylex.props(styles.jobPostingCardRow3)}>
            <span {...stylex.props(styles.jobPostingCardText)}>
              {formatRelativeDate(item.created_at)}
            </span>
            {safePostingUrl && (
              <a
                {...stylex.props(styles.jobPostingCardLink)}
                href={safePostingUrl}
                rel="noreferrer"
                target="_blank"
                title="원본 공고 열기"
              >
                <ExternalLink
                  {...stylex.props(styles.jobPostingCardExternalLink)}
                />
                <span {...stylex.props(styles.jobPostingCardText2)}>
                  원본 공고 열기
                </span>
              </a>
            )}
          </div>
        </div>

        <div {...stylex.props(styles.jobPostingCardRow4)}>
          <Building2 {...stylex.props(styles.jobPostingCardBuilding2)} />
          <span {...stylex.props(styles.jobPostingCardText3)}>
            {item.company_name}
          </span>
        </div>

        <h3 {...stylex.props(styles.jobPostingCardHeading)}>
          <Link
            to={`/job-postings/${item.id}`}
            {...stylex.props(styles.jobPostingCardLink2)}
          >
            {item.job_title}
          </Link>
        </h3>

        {hasDetails && (
          <div {...stylex.props(styles.jobPostingCardContainer2)}>
            <div {...stylex.props(styles.jobPostingCardRow5)}>
              {item.location && (
                <span {...stylex.props(styles.jobPostingCardText4)}>
                  <MapPin {...stylex.props(styles.jobPostingCardMapPin)} />
                  {item.location}
                </span>
              )}
              {item.experience_req && (
                <span {...stylex.props(styles.jobPostingCardText4)}>
                  <Briefcase {...stylex.props(styles.jobPostingCardMapPin)} />
                  {item.experience_req}
                </span>
              )}
            </div>

            <div {...stylex.props(styles.jobPostingCardRow6)}>
              {item.deadline && (
                <span {...stylex.props(styles.jobPostingCardText5)}>
                  마감: {item.deadline}
                </span>
              )}
              {item.salary && (
                <span {...stylex.props(styles.jobPostingCardText6)}>
                  {item.salary}
                </span>
              )}
            </div>
          </div>
        )}

        {item.tech_stack && item.tech_stack.length > 0 && (
          <div {...stylex.props(styles.jobPostingCardRow7)}>
            {item.tech_stack.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                xstyle={styles.jobPostingCardBadge}
                variant="secondary"
              >
                {tag}
              </Badge>
            ))}
            {item.tech_stack.length > 5 && (
              <Badge xstyle={styles.jobPostingCardBadge} variant="outline">
                +{item.tech_stack.length - 5}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 50;

const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f'];

function LoadingCard() {
  return (
    <Card xstyle={styles.loadingCardCard} data-stack="">
      <Skeleton xstyle={styles.loadingCardSkeleton} />
      <Skeleton xstyle={styles.loadingCardSkeleton2} />
      <Skeleton xstyle={styles.loadingCardSkeleton3} />
      <Skeleton xstyle={styles.loadingCardSkeleton4} />
      <div {...stylex.props(styles.loadingCardRow)}>
        <Skeleton xstyle={styles.loadingCardSkeleton5} />
        <Skeleton xstyle={styles.loadingCardSkeleton6} />
        <Skeleton xstyle={styles.loadingCardSkeleton7} />
      </div>
    </Card>
  );
}

function JobPostingsErrorState({
  error,
  onRetry,
}: {
  error: UserFacingError;
  onRetry: () => void;
}) {
  return (
    <div {...stylex.props(styles.jobPostingsErrorStateContainer)}>
      <div {...stylex.props(styles.jobPostingsErrorStateRow)}>
        <AlertCircle
          {...stylex.props(styles.jobPostingsErrorStateAlertCircle)}
        />
      </div>
      <h2 {...stylex.props(styles.jobPostingsErrorStateHeading)}>
        채용공고를 불러오지 못했습니다
      </h2>
      <p {...stylex.props(styles.jobPostingsErrorStateDescription)}>
        {error.message}
      </p>
      <p {...stylex.props(styles.jobPostingsErrorStateDescription2)}>
        {error.code}
      </p>
      <Button
        xstyle={styles.jobPostingsErrorStateButton}
        variant="outline"
        onClick={() => onRetry()}
      >
        <RefreshCw {...stylex.props(styles.jobPostingsErrorStateRefreshCw)} />
        다시 시도
      </Button>
    </div>
  );
}

function GroupFilterBar({
  groups,
  selected,
  onSelect,
}: {
  groups: JobSearchGroupItem[];
  selected: string | 'all';
  onSelect: (value: string | 'all') => void;
}) {
  return (
    <div {...stylex.props(styles.groupFilterBarRow)}>
      <button
        type="button"
        {...stylex.props([
          styles.groupFilterBarButton,
          selected === 'all'
            ? styles.groupFilterBarButton2
            : styles.groupFilterBarButton3,
        ])}
        onClick={() => onSelect('all')}
      >
        <Layers {...stylex.props(styles.jobPostingCardExternalLink)} />
        모든 공고
      </button>
      {groups.map((group, index) => (
        <button
          key={group.id}
          type="button"
          {...stylex.props([
            styles.groupFilterBarButton4,
            selected === group.id
              ? styles.groupFilterBarButton2
              : styles.groupFilterBarButton3,
          ])}
          onClick={() => onSelect(group.id)}
        >
          {index === 0 ? `${group.name} (현재)` : group.name}
          {group.posting_count > 0 && (
            <span
              {...stylex.props([
                styles.groupFilterBarText,
                selected === group.id
                  ? styles.groupFilterBarText2
                  : styles.groupFilterBarText3,
              ])}
            >
              {group.posting_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function JobPostingsPage() {
  useDocumentTitle('채용공고');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const groupParam = searchParams.get('group');

  const [activeGroups, setActiveGroups] = useState<JobSearchGroupItem[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Derive selected group: param takes precedence; default to first active group
  const selectedGroup: string | 'all' =
    groupParam === 'all'
      ? 'all'
      : (groupParam ??
        (groupsLoaded && activeGroups.length > 0 ? activeGroups[0].id : 'all'));

  const [items, setItems] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  // Load active groups for the filter bar
  useEffect(() => {
    const controller = new AbortController();
    fetchJobSearchGroups({ status: 'active', limit: 50 }, controller.signal)
      .then((data) => {
        setActiveGroups(data.items);
        setGroupsLoaded(true);
      })
      .catch(() => {
        // Non-critical: filter bar gracefully degrades
        setGroupsLoaded(true);
      });
    return () => controller.abort();
  }, []);

  // When groups finish loading and there's no explicit group param, set default
  useEffect(() => {
    if (groupsLoaded && activeGroups.length > 0 && groupParam === null) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('group', activeGroups[0].id);
          return next;
        },
        { replace: true },
      );
    }
  }, [groupsLoaded, activeGroups, groupParam, setSearchParams]);

  const groupId = selectedGroup === 'all' ? undefined : selectedGroup;

  const loadJobPostings = useCallback(
    (signal?: AbortSignal) => {
      const offset = (page - 1) * PAGE_SIZE;
      setIsLoading(true);
      setError(null);

      fetchJobPostings(offset, PAGE_SIZE, groupId, signal)
        .then((pageData) => {
          setItems(pageData.items);
          setTotal(pageData.total);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(toUserFacingError(err, '데이터를 불러오지 못했습니다.'));
        })
        .finally(() => {
          if (!signal?.aborted) setIsLoading(false);
        });
    },
    [page, groupId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadJobPostings(controller.signal);
    return () => controller.abort();
  }, [loadJobPostings]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function goToPage(newPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectGroup(value: string | 'all') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('group', value);
      next.delete('page');
      return next;
    });
  }

  return (
    <div
      {...stylex.props([styles.jobPostingsPageStack, motion.fadeIn])}
      data-stack=""
    >
      {/* Page header — transparent, floating on background */}
      <div {...stylex.props(styles.jobPostingsPageRow)}>
        <div>
          <p {...stylex.props(styles.jobPostingsPageDescription)}>
            Job Archive
          </p>
          <h1 {...stylex.props(styles.jobPostingsPageHeading)}>채용공고</h1>
          {!isLoading && !error && total > 0 && (
            <p {...stylex.props(styles.jobPostingsPageDescription2)}>
              총 {total}개의 채용공고
            </p>
          )}
        </div>
        <div {...stylex.props(styles.jobPostingsPageRow2)}>
          <SummaryChip
            label="저장된 공고"
            value={isLoading ? '-' : total.toString()}
          />
          <SummaryChip
            label="최근 등록"
            value={
              !isLoading && items.length > 0
                ? formatRelativeDate(items[0].created_at)
                : '-'
            }
          />
          <Button asChild xstyle={styles.jobPostingsPageButton}>
            <Link
              to={
                selectedGroup !== 'all'
                  ? `/job-postings/new?group=${selectedGroup}`
                  : '/job-postings/new'
              }
            >
              <PlusCircle
                {...stylex.props(styles.jobPostingsErrorStateRefreshCw)}
              />
              새 채용공고 등록
            </Link>
          </Button>
        </div>
      </div>

      {/* Group filter bar */}
      {groupsLoaded && (
        <GroupFilterBar
          groups={activeGroups}
          selected={selectedGroup}
          onSelect={selectGroup}
        />
      )}

      {isLoading && (
        <div {...stylex.props(styles.jobPostingsPageGrid)}>
          {SKELETON_KEYS.map((key) => (
            <LoadingCard key={key} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <JobPostingsErrorState error={error} onRetry={loadJobPostings} />
      )}

      {!isLoading && !error && items.length === 0 && (
        <div {...stylex.props(styles.jobPostingsPageGrid)}>
          <Card xstyle={styles.jobPostingsPageCard} glass>
            <div {...stylex.props(styles.jobPostingsPageRow3)}>
              <Sparkles
                {...stylex.props(styles.jobPostingsErrorStateAlertCircle)}
              />
            </div>
            <div>
              <h3 {...stylex.props(styles.jobPostingsPageHeading2)}>
                아직 저장된 채용공고가 없어요
              </h3>
              <p {...stylex.props(styles.jobPostingsPageDescription2)}>
                첫 번째 채용공고를 등록해 보세요
              </p>
            </div>
            <Button asChild>
              <Link
                to={
                  selectedGroup !== 'all'
                    ? `/job-postings/new?group=${selectedGroup}`
                    : '/job-postings/new'
                }
              >
                <PlusCircle
                  {...stylex.props(styles.jobPostingsErrorStateRefreshCw)}
                />
                채용공고 등록하기
              </Link>
            </Button>
          </Card>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div
          {...stylex.props(styles.jobPostingsPageGrid2)}
          data-postings-grid=""
        >
          {items.map((item) => (
            <JobPostingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!isLoading && !error && totalPages > 1 && (
        <div {...stylex.props(styles.jobPostingsPageRow4)}>
          <Button
            disabled={!hasPrev}
            size="sm"
            variant="outline"
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft
              {...stylex.props(styles.jobPostingsErrorStateRefreshCw)}
            />
            이전
          </Button>
          <span {...stylex.props(styles.jobPostingsPageText)}>
            {page} / {totalPages}
          </span>
          <Button
            disabled={!hasNext}
            size="sm"
            variant="outline"
            onClick={() => goToPage(page + 1)}
          >
            다음
            <ChevronRight
              {...stylex.props(styles.jobPostingsErrorStateRefreshCw)}
            />
          </Button>
        </div>
      )}
    </div>
  );
}

const styles = stylex.create({
  summaryChipContainer: {
    minWidth: '7rem',
    borderRadius: '.75rem',
    borderColor: 'color-mix(in oklab, #fff 12%, transparent)',
    backgroundColor: 'hsl(var(--accent))',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.625rem',
    paddingBottom: '0.625rem',
    backdropFilter: 'blur(12px)',
  },
  summaryChipDescription: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '.025em',
    color: 'oklch(44.6% .03 256.802)',
    textTransform: 'uppercase',
  },
  summaryChipDescription2: {
    marginTop: '0.125rem',
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 600,
    letterSpacing: '-.025em',
    color: 'hsl(var(--foreground))',
  },
  jobPostingCardCard: {
    position: 'relative',
    overflow: 'hidden',
    outlineWidth: {
      default: null,
      ':has(:focus-visible)': '2px',
    },
    outlineStyle: {
      default: null,
      ':has(:focus-visible)': 'solid',
    },
    outlineColor: {
      default: null,
      ':has(:focus-visible)': 'hsl(var(--primary))',
    },
    outlineOffset: {
      default: null,
      ':has(:focus-visible)': '2px',
    },
  },
  jobPostingCardContainer: {
    position: 'absolute',
    top: '0rem',
    bottom: '0rem',
    left: '0rem',
    width: '0.25rem',
  },
  jobPostingCardCardContent: {
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.5rem',
  },
  jobPostingCardRow: {
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  jobPostingCardRow2: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
  },
  jobPostingCardRow3: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  jobPostingCardText: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingCardLink: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    height: '1.5rem',
    width: '1.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.5rem',
    color: {
      default: 'oklch(70.7% .022 261.325)',
      ':hover': 'hsl(var(--primary))',
    },
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    backgroundColor: {
      default: null,
      ':hover': 'hsl(var(--accent))',
    },
  },
  jobPostingCardExternalLink: {
    height: '0.875rem',
    width: '0.875rem',
  },
  jobPostingCardText2: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  jobPostingCardRow4: {
    marginBottom: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  jobPostingCardBuilding2: {
    height: '0.875rem',
    width: '0.875rem',
    color: 'oklch(44.6% .03 256.802)',
    flexShrink: 0,
  },
  jobPostingCardText3: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: 'oklch(44.6% .03 256.802)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  jobPostingCardHeading: {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    color: {
      default: null,
      [stylex.when.ancestor(':hover')]: 'hsl(var(--primary))',
    },
  },
  jobPostingCardLink2: {
    outlineStyle: {
      default: null,
      ':focus-visible': 'none',
    },
    '::after': {
      position: 'absolute',
      top: '0rem',
      bottom: '0rem',
      left: '0rem',
      right: '0rem',
      content: "''",
    },
  },
  jobPostingCardContainer2: {
    marginTop: '0.75rem',
    borderRadius: '.75rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, #fff 8%, transparent)',
    backgroundColor: 'hsl(var(--muted))',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
  },
  jobPostingCardRow5: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: '0.75rem',
    rowGap: '0.25rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingCardText4: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  jobPostingCardMapPin: {
    height: '0.75rem',
    width: '0.75rem',
  },
  jobPostingCardRow6: {
    marginTop: '0.5rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
  },
  jobPostingCardText5: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 8%, transparent)',
    paddingLeft: '0.625rem',
    paddingRight: '0.625rem',
    paddingTop: '0.125rem',
    paddingBottom: '0.125rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
    color: 'oklch(57.7% .245 27.325)',
    borderWidth: '1px',
    borderColor:
      'color-mix(in oklab, oklch(63.7% .237 25.331) 15%, transparent)',
  },
  jobPostingCardText6: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    backgroundColor: 'hsl(var(--muted))',
    paddingLeft: '0.625rem',
    paddingRight: '0.625rem',
    paddingTop: '0.125rem',
    paddingBottom: '0.125rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
    color: 'oklch(44.6% .03 256.802)',
    borderWidth: '1px',
  },
  jobPostingCardRow7: {
    marginTop: '0.75rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  jobPostingCardBadge: {
    fontSize: '.75rem',
    lineHeight: '1rem',
  },
  loadingCardCard: {
    '--stack-space': '0.75rem',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  loadingCardSkeleton: {
    height: '1rem',
    width: '6rem',
  },
  loadingCardSkeleton2: {
    height: '1.5rem',
    width: '75%',
  },
  loadingCardSkeleton3: {
    height: '1.25rem',
    width: '100%',
  },
  loadingCardSkeleton4: {
    height: '1rem',
    width: '50%',
  },
  loadingCardRow: {
    display: 'flex',
    gap: '0.5rem',
    paddingTop: '0.5rem',
  },
  loadingCardSkeleton5: {
    height: '1.5rem',
    width: '4rem',
  },
  loadingCardSkeleton6: {
    height: '1.5rem',
    width: '5rem',
  },
  loadingCardSkeleton7: {
    height: '1.5rem',
    width: '3.5rem',
  },
  jobPostingsErrorStateContainer: {
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
  jobPostingsErrorStateRow: {
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
  jobPostingsErrorStateAlertCircle: {
    height: '1.75rem',
    width: '1.75rem',
  },
  jobPostingsErrorStateHeading: {
    marginTop: '1.25rem',
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  jobPostingsErrorStateDescription: {
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '0.5rem',
    maxWidth: '36rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  jobPostingsErrorStateDescription2: {
    marginTop: '0.75rem',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    color: 'oklch(63.7% .237 25.331)',
  },
  jobPostingsErrorStateButton: {
    marginTop: '1.5rem',
  },
  jobPostingsErrorStateRefreshCw: {
    height: '1rem',
    width: '1rem',
  },
  groupFilterBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    overflowX: 'auto',
    paddingBottom: '0.25rem',
    marginBottom: '-0.25rem',
  },
  groupFilterBarButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    flexShrink: 0,
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.375rem',
    paddingBottom: '0.375rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontWeight: 'inherit',
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    borderWidth: '1px',
  },
  groupFilterBarButton2: {
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    color: 'hsl(var(--primary))',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  groupFilterBarButton3: {
    color: 'oklch(44.6% .03 256.802)',
    borderColor: 'transparent',
    backgroundColor: {
      default: null,
      ':hover': 'hsl(var(--muted))',
    },
  },
  groupFilterBarButton4: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: '0.375rem',
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.375rem',
    paddingBottom: '0.375rem',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontWeight: 'inherit',
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    borderWidth: '1px',
  },
  groupFilterBarText: {
    display: 'inline-flex',
    height: '1rem',
    minWidth: '1rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    fontSize: '10px',
    fontWeight: 700,
  },
  groupFilterBarText2: {
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
    color: 'hsl(var(--primary))',
  },
  groupFilterBarText3: {
    backgroundColor: 'hsl(var(--muted))',
    color: 'oklch(55.1% .027 264.364)',
  },
  jobPostingsPageStack: {
    '--stack-space': '1.5rem',
  },
  jobPostingsPageRow: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 64rem)': 'row',
    },
    gap: '1.25rem',
    alignItems: {
      default: null,
      '@media (min-width: 64rem)': 'flex-end',
    },
    justifyContent: {
      default: null,
      '@media (min-width: 64rem)': 'space-between',
    },
  },
  jobPostingsPageDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
  },
  jobPostingsPageHeading: {
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 40rem)': '1.875rem',
    },
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  jobPostingsPageDescription2: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
    marginTop: '0.25rem',
  },
  jobPostingsPageRow2: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: '0.75rem',
    flexWrap: {
      default: null,
      '@media (min-width: 40rem)': 'wrap',
    },
    alignItems: {
      default: null,
      '@media (min-width: 40rem)': 'center',
    },
  },
  jobPostingsPageButton: {
    alignSelf: {
      default: null,
      '@media (min-width: 40rem)': 'stretch',
    },
  },
  jobPostingsPageGrid: {
    display: 'grid',
    gap: '1.25rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 64rem)': 'repeat(3, minmax(0, 1fr))',
    },
  },
  jobPostingsPageCard: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    paddingTop: '4rem',
    paddingBottom: '4rem',
    textAlign: 'center',
  },
  jobPostingsPageRow3: {
    display: 'flex',
    height: '4rem',
    width: '4rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '1rem',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 10%, transparent)',
    color: 'hsl(var(--primary))',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  jobPostingsPageHeading2: {
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
  },
  jobPostingsPageGrid2: {
    display: 'grid',
    gap: '1.25rem',
    gridTemplateColumns: {
      default: null,
      '@media (min-width: 40rem)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 64rem)': 'repeat(3, minmax(0, 1fr))',
    },
  },
  jobPostingsPageRow4: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    paddingTop: '0.5rem',
  },
  jobPostingsPageText: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
});
