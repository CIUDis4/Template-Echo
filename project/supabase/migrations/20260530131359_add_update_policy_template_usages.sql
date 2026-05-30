/*
  # Add UPDATE policy for template_usages

  ## Summary
  Allows authenticated users to update their own rows in template_usages
  (specifically the count field). Required now that engineers can edit
  their numeric market-sighting count.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'template_usages' AND policyname = 'Users can update own template usage'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update own template usage"
        ON template_usages FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $policy$;
  END IF;
END $$;
