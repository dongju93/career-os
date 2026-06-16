// Application Strategist plan (지원 전략 플랜) — the one-shot structured result
// of POST /v1/agent/plan. Plans are not persisted; the client regenerates on
// demand (§2), so these types describe a transient response only.

import type { ApplicationStatus } from './job-posting';

// How close a posting's deadline is, as judged server-side.
export type DeadlineUrgency = 'overdue' | 'soon' | 'later' | 'unknown';

// One prioritized posting in the plan. `job_id` is server-verified to belong to
// the caller, so it can be linked to /job-postings/{job_id} without re-checking.
export interface PlanItem {
  job_id: number;
  company_name: string;
  job_title: string;
  fit_score: number; // int 0–100
  matched_skills: string[];
  missing_skills: string[];
  deadline_urgency: DeadlineUrgency;
  recommended_action: string; // one concrete next step
  rationale: string;
}

// A single propose-then-execute suggestion (Phase 2, §6). The model proposes;
// nothing is written until the user confirms, at which point the client issues a
// PATCH /v1/job-postings/{job_id} carrying exactly the one matching field. Model
// output is untrusted — the user reviews each card before it takes effect.
export interface ProposedAction {
  action_type: 'set_status' | 'assign_group' | 'save_memo';
  job_id: number;
  application_status: ApplicationStatus | null; // for set_status
  target_group_id: string | null; // for assign_group (UUID of a group)
  memo: string | null; // for save_memo
  reason: string;
}

// The full plan. `proposed_actions` is a Phase 2 addition kept optional so a
// Phase 1 client (which omits it from its schema) stays forward-compatible; the
// Zod schema fills it via `.default([])`, so consumers can treat it as present.
export interface ApplicationPlan {
  summary: string;
  items: PlanItem[];
  proposed_actions?: ProposedAction[];
}
