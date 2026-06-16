import type { ApplicationStatus, Platform } from '../types/job-posting';

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

export function platformVariant(platform: Platform) {
  return platform === 'saramin' ? 'saramin' : 'wanted';
}

// Canonical Korean labels for the application-status lifecycle. Keep these the
// single source of truth — reuse everywhere the status is shown (§4.5).
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: '저장됨',
  applied: '지원 완료',
  interviewing: '면접 진행',
  offer: '오퍼',
  rejected: '불합격',
  withdrawn: '지원 철회',
};

type BadgeVariant =
  | 'secondary'
  | 'default'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'outline';

// Maps each status to a Badge variant (mirrors `platformVariant`): neutral when
// just saved, primary/amber while in progress, green for an offer, red when
// rejected, muted when withdrawn.
export function applicationStatusVariant(
  status: ApplicationStatus,
): BadgeVariant {
  switch (status) {
    case 'saved':
      return 'secondary';
    case 'applied':
      return 'default';
    case 'interviewing':
      return 'warning';
    case 'offer':
      return 'success';
    case 'rejected':
      return 'destructive';
    case 'withdrawn':
      return 'outline';
  }
}
