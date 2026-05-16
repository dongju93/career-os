export interface JobSearchGroupItem {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  memo: string | null;
  posting_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobSearchGroup
  extends Omit<JobSearchGroupItem, 'posting_count'> {}

export interface JobSearchGroupPage {
  items: JobSearchGroupItem[];
  total: number;
  offset: number;
  limit: number;
}
