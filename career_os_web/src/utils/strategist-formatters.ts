import type {
  DeadlineUrgency,
  ProposedAction,
} from '../types/application-plan';
import { APPLICATION_STATUS_LABELS } from './job-posting-formatters';

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

// Builds the human-readable Korean description for a proposed-action card (§6).
// `jobTitle` and `groupName` are resolved by the caller (from the plan's items
// and the fetched groups, with the raw id as a fallback) so this stays a pure
// string formatter with no lookup dependencies.
export function describeProposedAction(
  action: ProposedAction,
  jobTitle: string,
  groupName: string,
): string {
  switch (action.action_type) {
    case 'set_status': {
      const label = action.application_status
        ? APPLICATION_STATUS_LABELS[action.application_status]
        : '미정';
      return `'${jobTitle}' 상태를 '${label}'(으)로 변경`;
    }
    case 'assign_group':
      return `'${groupName}' 그룹으로 이동`;
    case 'save_memo':
      return `메모 저장: ${action.memo ?? ''}`;
  }
}
