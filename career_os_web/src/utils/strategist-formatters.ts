import type { DeadlineUrgency } from '../types/application-plan';

// Canonical Korean labels for deadline urgency (§5.3). Keep these the single
// source of truth wherever urgency is shown, mirroring APPLICATION_STATUS_LABELS.
export const DEADLINE_URGENCY_LABELS: Record<DeadlineUrgency, string> = {
  overdue: '마감 지남',
  soon: '마감 임박',
  later: '여유 있음',
  unknown: '마감일 미확인',
};

type StrategistBadgeVariant =
  | 'secondary'
  | 'default'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'outline';

// Maps deadline urgency to a Badge variant: red when the deadline has passed,
// amber when imminent, green when there is still room, neutral when unknown.
export function deadlineUrgencyVariant(
  urgency: DeadlineUrgency,
): StrategistBadgeVariant {
  switch (urgency) {
    case 'overdue':
      return 'destructive';
    case 'soon':
      return 'warning';
    case 'later':
      return 'success';
    case 'unknown':
      return 'secondary';
  }
}
