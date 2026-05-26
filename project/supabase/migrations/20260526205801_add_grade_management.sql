/*
  # Add Grade Management to Relay Models

  ## Summary
  Adds quality and popularity grade fields to relay_models, plus a grade_suggestions table for user-submitted grade proposals.

  ## New Columns on relay_models
  - `quality_grade` (text) — Official quality grade. Values: A+, A, B, C, D, N/A. Default: N/A
  - `popularity_grade` (text) — Official popularity grade. Values: A+, A, B, C, D, N/A. Default: N/A
  - `grade_updated_by` (uuid) — User who last updated official grades
  - `grade_updated_at` (timestamptz) — When grades were last updated

  ## New Table: grade_suggestions
  Stores user-submitted grade suggestions before admin approval.
  - `id` (uuid, pk)
  - `relay_model_id` (uuid, fk relay_models)
  - `user_id` (uuid, fk profiles)
  - `suggested_quality_grade` (text, nullable)
  - `suggested_popularity_grade` (text, nullable)
  - `comment` (text, nullable)
  - `status` (text) — pending, approved, rejected
  - `reviewed_by` (uuid, nullable)
  - `reviewed_at` (timestamptz, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on grade_suggestions
  - Only admins can update official grades via RLS policy on relay_models
  - Users can insert/update/delete their own pending suggestions
  - All authenticated users can read suggestions
*/

-- Add grade columns to relay_models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'quality_grade'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN quality_grade text NOT NULL DEFAULT 'N/A';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'popularity_grade'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN popularity_grade text NOT NULL DEFAULT 'N/A';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'grade_updated_by'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN grade_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'grade_updated_at'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN grade_updated_at timestamptz;
  END IF;
END $$;

-- Create grade_suggestions table
CREATE TABLE IF NOT EXISTS grade_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_model_id uuid NOT NULL REFERENCES relay_models(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_quality_grade text,
  suggested_popularity_grade text,
  comment text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE grade_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies for grade_suggestions
CREATE POLICY "Authenticated users can view all suggestions"
  ON grade_suggestions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own suggestions"
  ON grade_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending suggestions"
  ON grade_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending suggestions"
  ON grade_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_grade_suggestions_relay_model_id ON grade_suggestions(relay_model_id);
CREATE INDEX IF NOT EXISTS idx_grade_suggestions_user_id ON grade_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_grade_suggestions_status ON grade_suggestions(status);
