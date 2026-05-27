/*
  # Fix feedback_entries and activity_logs user_id FK to profiles

  ## Problem
  feedback_entries.user_id and activity_logs.user_id reference auth.users(id).
  PostgREST cannot auto-resolve the profiles(*) relationship from these tables
  because the FK points to the internal auth schema, not the public profiles table.

  This causes the profiles(*) join to silently return null in all API queries,
  so submitter names never display and — more critically — when the detail page
  uses this query to build the feedback list, it can result in empty or broken
  data being shown even though the data exists in the database.

  ## Fix
  Re-point both FKs to profiles(id). Since profiles.id is always the same UUID
  as auth.users.id (created by trigger on signup), this is a safe change with
  no data impact. The ON DELETE CASCADE behaviour is preserved.

  ## Tables changed
  - feedback_entries: user_id FK -> profiles(id)
  - activity_logs:    user_id FK -> profiles(id) (with SET NULL preserved)
*/

-- Fix feedback_entries
ALTER TABLE feedback_entries
  DROP CONSTRAINT IF EXISTS feedback_entries_user_id_fkey;

ALTER TABLE feedback_entries
  ADD CONSTRAINT feedback_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Fix activity_logs
ALTER TABLE activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix feedback_attachments indirectly relies on feedback_entries which is now correct.
-- No change needed there as its FK already points to feedback_entries(id).
