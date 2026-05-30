/*
  # Create template_usages table

  ## Summary
  Adds Community Usage Tracking — lets engineers mark which relay templates
  they actively work with. One record per (user, model) pair.

  ## New Tables
  - `template_usages`
    - `id`             (uuid, pk)
    - `relay_model_id` (uuid, FK → relay_models.id, cascade delete)
    - `user_id`        (uuid, FK → profiles.id, cascade delete)
    - `created_at`     (timestamptz, defaults to now())
    - UNIQUE (relay_model_id, user_id) — one toggle per user per model

  ## Security
  - RLS enabled; users can only manage their own rows.
  - Admins and engineers can SELECT all rows (needed for usage count aggregation).
  - Any authenticated user can INSERT / DELETE only their own row.

  ## Notes
  1. Usage count = COUNT(*) per relay_model_id (unique users).
  2. This table is independent of relay_model_ratings — touching it will not affect Quality or Popularity logic.
*/

CREATE TABLE IF NOT EXISTS template_usages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_model_id uuid NOT NULL REFERENCES relay_models(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (relay_model_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_template_usages_model ON template_usages(relay_model_id);
CREATE INDEX IF NOT EXISTS idx_template_usages_user  ON template_usages(user_id);

ALTER TABLE template_usages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed to aggregate usage counts)
CREATE POLICY "Authenticated users can view template usages"
  ON template_usages FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own usage
CREATE POLICY "Users can insert own template usage"
  ON template_usages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own usage
CREATE POLICY "Users can delete own template usage"
  ON template_usages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
