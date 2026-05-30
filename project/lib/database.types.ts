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
