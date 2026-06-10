export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'engineer' | 'viewer';
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: 'admin' | 'engineer' | 'viewer';
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'admin' | 'engineer' | 'viewer';
          active?: boolean;
          created_at?: string;
        };
      };
      relay_models: {
        Row: {
          id: string;
          model_name: string;
          manufacturer: string;
          relay_family: string;
          firmware_version: string;
          template_version: string;
          status: 'active' | 'deprecated' | 'review';
          cloud_mod_date: string | null;
          has_pdf: boolean;
          quality_grade: string;
          popularity_grade: string;
          official_quality_grade: string;
          official_popularity_grade: string;
          grade_updated_by: string | null;
          grade_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          model_name: string;
          manufacturer?: string;
          relay_family?: string;
          firmware_version?: string;
          template_version?: string;
          status?: 'active' | 'deprecated' | 'review';
          cloud_mod_date?: string | null;
          has_pdf?: boolean;
          quality_grade?: string;
          popularity_grade?: string;
          official_quality_grade?: string;
          official_popularity_grade?: string;
          grade_updated_by?: string | null;
          grade_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          model_name?: string;
          manufacturer?: string;
          relay_family?: string;
          firmware_version?: string;
          template_version?: string;
          status?: 'active' | 'deprecated' | 'review';
          cloud_mod_date?: string | null;
          has_pdf?: boolean;
          quality_grade?: string;
          popularity_grade?: string;
          official_quality_grade?: string;
          official_popularity_grade?: string;
          grade_updated_by?: string | null;
          grade_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      relay_model_ratings: {
        Row: {
          id: string;
          relay_model_id: string;
          user_id: string;
          quality_grade: string | null;
          popularity_grade: string | null;
          comment: string;
          is_flagged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          relay_model_id: string;
          user_id: string;
          quality_grade?: string | null;
          popularity_grade?: string | null;
          comment?: string;
          is_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          relay_model_id?: string;
          user_id?: string;
          quality_grade?: string | null;
          popularity_grade?: string | null;
          comment?: string;
          is_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback_entries: {
        Row: {
          id: string;
          relay_model_id: string;
          user_id: string;
          title: string;
          description: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          estimated_fix_hours: number;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          relay_model_id: string;
          user_id: string;
          title: string;
          description?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          estimated_fix_hours?: number;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          relay_model_id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          estimated_fix_hours?: number;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback_attachments: {
        Row: {
          id: string;
          feedback_id: string;
          file_url: string;
          file_name: string;
          file_type: string;
          file_size: number;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          feedback_id: string;
          file_url: string;
          file_name: string;
          file_type?: string;
          file_size?: number;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          feedback_id?: string;
          file_url?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          uploaded_at?: string;
        };
      };
      template_usages: {
        Row: {
          id: string;
          relay_model_id: string;
          user_id: string;
          count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          relay_model_id: string;
          user_id: string;
          count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          relay_model_id?: string;
          user_id?: string;
          count?: number;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type RelayModel = Database['public']['Tables']['relay_models']['Row'];
export type FeedbackEntry = Database['public']['Tables']['feedback_entries']['Row'];
export type FeedbackAttachment = Database['public']['Tables']['feedback_attachments']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type RelayModelRating = Database['public']['Tables']['relay_model_ratings']['Row'];

export type TemplateUsage = Database['public']['Tables']['template_usages']['Row'];

// ============================================================
// Driver Bug Tracker types
// ============================================================

export type BugStatus = 'New' | 'Open' | 'In Progress' | 'Testing' | 'Resolved' | 'Closed' | 'Deferred' | 'Duplicate' | 'Rejected';
export type BugPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type BugSeverity = 'Minor' | 'Major' | 'Critical' | 'Blocker';
export type BugReproducibility = 'Always' | 'Often' | 'Sometimes' | 'Rarely' | 'Unable' | 'N/A';

export interface DriverBug {
  id: string;
  bug_number: number;
  title: string;
  description: string;
  status: BugStatus;
  priority: BugPriority;
  severity: BugSeverity;
  reproducibility: BugReproducibility;
  software_version: string;
  build_version: string;
  affected_module: string;
  affected_driver: string;
  operating_system: string;
  browser: string;
  expected_behavior: string;
  actual_behavior: string;
  steps_to_reproduce: string;
  workaround: string;
  additional_notes: string;
  reporter_id: string;
  assigned_to_id: string | null;
  assigned_at: string | null;
  due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BugComment {
  id: string;
  bug_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface BugAttachment {
  id: string;
  bug_id: string;
  comment_id: string | null;
  uploader_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
}

export interface BugHistory {
  id: string;
  bug_id: string;
  changed_by_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export type GradeValue = 'A+' | 'A' | 'B' | 'C' | 'D' | 'N/A';

export interface GradeSuggestion {
  id: string;
  relay_model_id: string;
  user_id: string;
  suggested_quality_grade: string | null;
  suggested_popularity_grade: string | null;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface RelayModelRatingWithProfile extends RelayModelRating {
  profiles?: Profile;
}

// Grade numeric map for computing weighted averages
export const GRADE_NUMERIC: Record<string, number> = {
  'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'N/A': 0,
};
export const NUMERIC_GRADE: Record<number, string> = {
  5: 'A+', 4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'N/A',
};

export function computeCommunityGrade(ratings: Array<{ quality_grade?: string | null; popularity_grade?: string | null }>, field: 'quality_grade' | 'popularity_grade'): { grade: string; count: number } {
  const values = ratings
    .map(r => r[field])
    .filter((g): g is string => !!g && g !== 'N/A');

  if (values.length === 0) return { grade: 'N/A', count: 0 };

  // Mode (most common)
  const freq = new Map<string, number>();
  values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return { grade: sorted[0][0], count: values.length };
}

// ── Template Requests module ─────────────────────────────────────

export type TRStatus =
  | 'New' | 'Under Review' | 'Approved' | 'Planned'
  | 'In Development' | 'Testing' | 'Released' | 'Rejected' | 'Deferred';

export type TRPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TRType =
  | 'New Template' | 'Existing Template Upgrade' | 'New Firmware Support'
  | 'New Relay Family' | 'Business Requirement' | 'Other';

export interface TemplateRequest {
  id: string;
  request_number: number;
  title: string;
  manufacturer: string;
  relay_model: string;
  firmware_version: string;
  request_type: TRType;
  justification: string;
  customer_utility: string;
  region: string;
  priority: TRPriority;
  status: TRStatus;
  assigned_to: string | null;
  internal_notes: string;
  submitted_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateRequestComment {
  id: string;
  request_id: string;
  user_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateRequestAttachment {
  id: string;
  request_id: string;
  comment_id: string | null;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
}

export const TR_STATUSES: TRStatus[] = [
  'New', 'Under Review', 'Approved', 'Planned',
  'In Development', 'Testing', 'Released', 'Rejected', 'Deferred',
];

export const TR_PRIORITIES: TRPriority[] = ['Critical', 'High', 'Medium', 'Low'];

export const TR_TYPES: TRType[] = [
  'New Template', 'Existing Template Upgrade', 'New Firmware Support',
  'New Relay Family', 'Business Requirement', 'Other',
];

export const TR_MANUFACTURERS = [
  'SEL', 'GE', 'ABB', 'Siemens', 'Hitachi Energy',
  'Schneider', 'NR', 'ZIV', 'Sifang', 'Other',
];

export const TR_REGIONS = [
  'North America', 'South America', 'Europe',
  'Middle East', 'Asia Pacific', 'Africa',
];

export const TR_STATUS_COLORS: Record<TRStatus, string> = {
  'New': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Under Review': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Approved': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Planned': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'In Development': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'Testing': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Released': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Deferred': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const TR_PRIORITY_COLORS: Record<TRPriority, string> = {
  'Critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'High': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Low': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
