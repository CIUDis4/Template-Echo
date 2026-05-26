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
