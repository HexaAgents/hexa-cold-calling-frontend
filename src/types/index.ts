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
  state: string | null;
  country: string | null;
  timezone: string | null;
  email: string | null;
  mobile_phone: string | null;
  work_direct_phone: string | null;
  corporate_phone: string | null;
  score: number | null;
  company_type: string | null;
  rationale: string | null;
  rejection_reason: string | null;
  company_description: string | null;
  industry_tag: string | null;
  exa_scrape_success: boolean;
  scoring_failed: boolean;
  call_occasion_count: number;
  times_called: number;
  call_outcome: string | null;
  messaging_status: string | null;
  sms_sent: boolean;
  sms_sent_after_calls: number | null;
  sms_scheduled_at: string | null;
  enrichment_status: string | null;
  retry_at: string | null;
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
  contact_id: string | null;
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
  email_prompt_needed: boolean;
  occasion_count: number;
  times_called: number;
  retry_at: string | null;
}

export interface CallLogDeleteResponse {
  contact_id: string;
  times_called: number;
  call_outcome: string | null;
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
  retry_days: number;
  email_template_didnt_pick_up: string;
  email_template_interested: string;
  email_subject_didnt_pick_up: string;
  email_subject_interested: string;
}

export interface EmailLog {
  id: string;
  contact_id: string;
  user_id: string;
  gmail_address: string;
  recipient_email: string;
  subject: string;
  body: string;
  outcome_context: string | null;
  sent_at: string;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string;
  total_rows: number;
  processed_rows: number;
  stored_rows: number;
  discarded_rows: number;
  enriched_rows: number;
  enrichment_error: string | null;
  status: string;
  created_at: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface ProductivityUser {
  id: string;
  first_name: string;
}

export interface ProductivityRow {
  date: string;
  counts: Record<string, number>;
}

export interface OutcomeBreakdown {
  total: number;
  didnt_pick_up: number;
  interested: number;
  not_interested: number;
  bad_number: number;
  other: number;
}

export interface UserOutcomeBreakdown {
  user_id: string;
  first_name: string;
  breakdown: OutcomeBreakdown;
}

export interface ProductivityResponse {
  users: ProductivityUser[];
  rows: ProductivityRow[];
  overall_breakdown: OutcomeBreakdown;
  per_user_breakdown: UserOutcomeBreakdown[];
}

export interface TrackedContact {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string;
  email: string;
  sent_count: number;
  received_count: number;
  last_sent_at: string | null;
  last_received_at: string | null;
  reply_status: "replied" | "awaiting_reply" | "no_emails";
}

export interface TrackedEmail {
  id: string;
  gmail_message_id: string;
  from_address: string;
  to_address: string;
  subject: string;
  snippet: string;
  direction: "sent" | "received";
  message_date: string;
}

export interface CompanySummary {
  company_name: string;
  website: string | null;
  company_linkedin_url: string | null;
  company_description: string | null;
  employees: string | null;
  industry_tag: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_count: number;
  avg_score: number | null;
}

export interface CompanyDetail {
  company: CompanySummary;
  contacts: Contact[];
}

export interface ScheduledCall {
  id: string;
  contact_id: string;
  user_id: string;
  scheduled_at: string;
  notes: string | null;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  contact_name: string;
  company_name: string;
  user_name: string;
}
