// Per-posting application artifacts (이력서 불릿 / 자기소개서 포인트 / 면접 준비) —
// the one-shot structured result of POST /v1/agent/artifact (Phase 3, §7).
// Like the plan, artifacts are not persisted; the client regenerates on demand.

// Which kind of artifact the agent should write for a given posting.
export type ArtifactType = 'resume_bullets' | 'cover_letter' | 'interview_prep';

// A single generated artifact. `content_markdown` is rendered as pre-wrapped
// plain text on the client (no markdown dependency, §7); `job_id` is the posting
// it was generated for, echoed back by the server.
export interface ApplicationArtifact {
  artifact_type: ArtifactType;
  job_id: number;
  title: string;
  content_markdown: string; // ≤ 12000 chars
}
