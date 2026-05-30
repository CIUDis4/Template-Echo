/*
  # Add count column to template_usages

  ## Summary
  Changes the template_usages table from a boolean "I use this" toggle to a
  numeric market-sighting counter. Each engineer reports how many times they
  have seen this relay model deployed at customer sites. The displayed "Count"
  is the SUM of all engineers' individual counts.

  ## Changes
  - `template_usages`
    - ADD COLUMN `count` (integer, NOT NULL, DEFAULT 1, CHECK count >= 1)
      Stores the number of customer/site sightings reported by this engineer.

  ## Notes
  1. Existing rows (if any) receive count = 1 as the default.
  2. The total displayed count = SUM(count) across all rows for a model.
  3. The unique-user count is still available via COUNT(*).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_usages' AND column_name = 'count'
  ) THEN
    ALTER TABLE template_usages ADD COLUMN count integer NOT NULL DEFAULT 1 CHECK (count >= 1);
  END IF;
END $$;
