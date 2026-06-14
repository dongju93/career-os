// Application Strategist plan (지원 전략 플랜) — the one-shot structured result
// of POST /v1/agent/plan. Plans are not persisted; the client regenerates on
// demand (§2), so these types describe a transient response only.

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

// The full plan. `proposed_actions` is a Phase 2 addition — intentionally absent
// here so the Phase 1 client neither depends on nor renders it.
export interface ApplicationPlan {
  summary: string;
  items: PlanItem[];
}
