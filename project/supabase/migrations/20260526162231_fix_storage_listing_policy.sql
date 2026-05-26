/*
  # Fix Public Bucket Listing Vulnerability

  Drops the broad SELECT policy on storage.objects for the feedback-files bucket
  that allows clients to list all files. Replaces it with a restrictive policy
  that requires users to only access objects they own, preventing directory listing
  while still allowing direct object URL access.
*/

DROP POLICY IF EXISTS "Authenticated users can view feedback files" ON storage.objects;

CREATE POLICY "Users can view own feedback files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
