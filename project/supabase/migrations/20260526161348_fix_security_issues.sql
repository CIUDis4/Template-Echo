/*
  # Fix Security Issues

  1. Set search_path on handle_new_user and update_updated_at_column to prevent
     mutable search_path exploits.
  2. Revoke EXECUTE on handle_new_user from anon and authenticated roles so it
     cannot be called via REST API.
  3. Drop the broad SELECT policy on storage.objects that allows listing all files
     in the feedback-files bucket, and replace it with a tighter object-level policy.
*/

-- ── Fix mutable search_path on both functions ────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, active)
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
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Revoke EXECUTE on handle_new_user from API-accessible roles ──────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- ── Fix storage listing: drop the broad SELECT policy and replace it ─────────

DROP POLICY IF EXISTS "Public can view feedback files" ON storage.objects;

-- Allow access only to individual objects (no directory listing)
CREATE POLICY "Authenticated users can view feedback files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'feedback-files');
