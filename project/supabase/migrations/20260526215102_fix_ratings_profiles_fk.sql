/*
  # Fix relay_model_ratings foreign key for profiles join

  ## Problem
  relay_model_ratings.user_id references auth.users(id), but PostgREST
  auto-join via profiles(*) requires a direct FK to the profiles table.

  ## Fix
  Add a foreign key from relay_model_ratings.user_id to profiles(id) so that
  Supabase can resolve the profiles(*) relationship in select queries.

  Note: profiles.id is already synced with auth.users.id (same UUID), so this
  is safe and won't change any data.
*/

ALTER TABLE relay_model_ratings
  DROP CONSTRAINT IF EXISTS relay_model_ratings_user_id_fkey;

ALTER TABLE relay_model_ratings
  ADD CONSTRAINT relay_model_ratings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
