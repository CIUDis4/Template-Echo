/*
  # Create relay_model_ratings table

  ## Summary
  Introduces a per-user collaborative rating system for relay models.
  Each user can submit exactly one rating per relay model. The official
  grade on relay_models is only controlled by admins and is separate.

  ## New Table: relay_model_ratings
  One row per (relay_model_id, user_id) pair.

  ### Columns
  - `id` (uuid, pk)
  - `relay_model_id` (uuid, fk → relay_models.id, cascade delete)
  - `user_id` (uuid, fk → auth.users.id, cascade delete)
  - `quality_grade` (text, nullable) — user's quality rating
  - `popularity_grade` (text, nullable) — user's popularity rating
  - `comment` (text) — optional reasoning
  - `is_flagged` (bool) — admin can flag spam/inaccurate entries
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Constraints
  - UNIQUE (relay_model_id, user_id) — one rating per user per model

  ## Also adds official grade columns to relay_models
  - `official_quality_grade` (text, default 'N/A')
  - `official_popularity_grade` (text, default 'N/A')

  ## Security
  - RLS enabled on relay_model_ratings
  - Users can insert/update/delete their own non-flagged ratings
  - Admins can view and manage all ratings (via service role or profiles.role check)
  - All authenticated users can read all non-flagged ratings
*/

-- Add official grade columns to relay_models (separate from community grades)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'official_quality_grade'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN official_quality_grade text NOT NULL DEFAULT 'N/A';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relay_models' AND column_name = 'official_popularity_grade'
  ) THEN
    ALTER TABLE relay_models ADD COLUMN official_popularity_grade text NOT NULL DEFAULT 'N/A';
  END IF;
END $$;

-- Create relay_model_ratings table
CREATE TABLE IF NOT EXISTS relay_model_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_model_id uuid NOT NULL REFERENCES relay_models(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quality_grade text,
  popularity_grade text,
  comment text NOT NULL DEFAULT '',
  is_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relay_model_ratings_unique_user UNIQUE (relay_model_id, user_id)
);

-- Enable RLS
ALTER TABLE relay_model_ratings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read non-flagged ratings
CREATE POLICY "Authenticated users can read non-flagged ratings"
  ON relay_model_ratings FOR SELECT
  TO authenticated
  USING (is_flagged = false OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Users can insert their own rating
CREATE POLICY "Users can insert their own rating"
  ON relay_model_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own non-flagged rating
CREATE POLICY "Users can update their own rating"
  ON relay_model_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_flagged = false)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own non-flagged rating
CREATE POLICY "Users can delete their own rating"
  ON relay_model_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_flagged = false);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_relay_model_ratings_model_id ON relay_model_ratings(relay_model_id);
CREATE INDEX IF NOT EXISTS idx_relay_model_ratings_user_id ON relay_model_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_relay_model_ratings_flagged ON relay_model_ratings(is_flagged);
