/*
  # RelayPulse - Full Schema Migration

  ## Overview
  Creates the complete database schema for the RelayPulse application, an enterprise
  relay template feedback and issue tracking system.

  ## New Tables

  ### 1. `profiles`
  - Extended user data linked to auth.users
  - Stores full_name, role (admin/engineer/viewer), and active status

  ### 2. `relay_models`
  - Core relay model catalog
  - Fields: model_name, manufacturer, relay_family, firmware_version, template_version, status

  ### 3. `feedback_entries`
  - Issue/feedback submissions linked to relay models and users
  - Fields: title, description, severity (low/medium/high/critical), estimated_fix_hours, status

  ### 4. `feedback_attachments`
  - Files attached to feedback entries (images, PDFs, ZIPs, logs)
  - Stores file_url, file_name, file_type

  ### 5. `activity_logs`
  - Audit trail for all major user actions
  - Tracks submissions, uploads, updates, deletions, logins

  ## Security
  - RLS enabled on all tables
  - Admins have full access
  - Engineers can create/edit their own feedback
  - Viewers have read-only access
  - All policies use auth.uid() checks
*/

-- ─── PROFILES ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'engineer', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Allow the trigger to insert profiles on signup
CREATE POLICY "Service can insert profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ─── RELAY MODELS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relay_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  relay_family text NOT NULL DEFAULT '',
  firmware_version text NOT NULL DEFAULT '',
  template_version text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'review')),
  cloud_mod_date timestamptz,
  has_pdf boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE relay_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view relay models"
  ON relay_models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert relay models"
  ON relay_models FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins and engineers can update relay models"
  ON relay_models FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'engineer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'engineer')));

CREATE POLICY "Admins can delete relay models"
  ON relay_models FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── FEEDBACK ENTRIES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_model_id uuid NOT NULL REFERENCES relay_models(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  estimated_fix_hours numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all feedback"
  ON feedback_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert feedback"
  ON feedback_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'engineer') AND active = true));

CREATE POLICY "Users can update own feedback"
  ON feedback_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can delete own feedback"
  ON feedback_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── FEEDBACK ATTACHMENTS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback_entries(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON feedback_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attachments"
  ON feedback_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM feedback_entries fe
      WHERE fe.id = feedback_id
      AND (fe.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON feedback_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feedback_entries fe
      WHERE fe.id = feedback_id
      AND (fe.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own activity"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── FUNCTION: auto-create profile on signup ─────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── FUNCTION: update updated_at timestamps ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_relay_models_updated_at ON relay_models;
CREATE TRIGGER set_relay_models_updated_at
  BEFORE UPDATE ON relay_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_feedback_entries_updated_at ON feedback_entries;
CREATE TRIGGER set_feedback_entries_updated_at
  BEFORE UPDATE ON feedback_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_relay_models_manufacturer ON relay_models(manufacturer);
CREATE INDEX IF NOT EXISTS idx_relay_models_status ON relay_models(status);
CREATE INDEX IF NOT EXISTS idx_feedback_relay_model ON feedback_entries(relay_model_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_severity ON feedback_entries(severity);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_entries(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
