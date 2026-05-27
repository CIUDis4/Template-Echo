/*
  # Fix relay_model_ratings SELECT policy

  ## Problem
  The current SELECT policy hides flagged ratings from the user who submitted them.
  This causes the UI to think no rating exists, breaking the "Update Your Rating" flow.

  ## Fix
  Allow users to always see their own ratings regardless of flagged status.
  Other users still cannot see flagged entries unless they are admin.
*/

DROP POLICY IF EXISTS "Authenticated users can read non-flagged ratings" ON relay_model_ratings;

CREATE POLICY "Authenticated users can read ratings"
  ON relay_model_ratings FOR SELECT
  TO authenticated
  USING (
    -- Own ratings always visible
    auth.uid() = user_id
    OR
    -- Non-flagged ratings visible to everyone
    is_flagged = false
    OR
    -- Admins see everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
