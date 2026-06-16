// Career profile (프로필) the user maintains once and reuses across the
// Application Strategist feature instead of pasting a resume into chat.
// Every field is nullable: the backend stores partial profiles.
export interface UserProfile {
  headline: string | null;
  years_experience: number | null;
  target_roles: string[] | null;
  skills: string[] | null;
  locations: string[] | null;
  salary_expectation: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

// Full-replace upsert body for PUT /v1/profile — the seven editable fields,
// without the server-managed timestamps.
export type UserProfileUpsert = Omit<UserProfile, 'created_at' | 'updated_at'>;
