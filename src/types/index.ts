export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string;
  person_linkedin_url: string | null;
  website: string | null;
  company_linkedin_url: string | null;
  employees: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  mobile_phone: string | null;
  work_direct_phone: string | null;
  corporate_phone: string | null;
  score: number | null;
  company_type: string | null;
  rationale: string | null;
  rejection_reason: string | null;
  exa_scrape_success: boolean;
  scoring_failed: boolean;
  call_occasion_count: number;
  times_called: number;
  call_outcome: string | null;
  messaging_status: string | null;
  sms_sent: boolean;
  sms_sent_after_calls: number | null;
  sms_scheduled_at: string | null;
  created_at: string | null;
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  per_page: number;
}

export interface CallLog {
  id: string;
  contact_id: string;
  user_id: string;
  call_date: string;
  call_method: string;
  phone_number_called: string | null;
  outcome: string | null;
  is_new_occasion: boolean;
  created_at: string | null;
}

export interface CallLogResponse {
  call_log: CallLog;
  sms_prompt_needed: boolean;
  occasion_count: number;
  times_called: number;
}

export interface Note {
  id: string;
  contact_id: string;
  user_id: string;
  content: string;
  note_date: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Settings {
  id: string;
  sms_call_threshold: number;
  sms_template: string;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string;
  total_rows: number;
  processed_rows: number;
  stored_rows: number;
  discarded_rows: number;
  status: string;
  created_at: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
}
