/*
  # Create Supabase Storage Bucket for Feedback Files

  Creates a public bucket for storing feedback attachments including:
  - Images (screenshots, diagrams)
  - PDFs
  - ZIP files
  - Log files

  Storage policies restrict uploads to authenticated users and limit
  deletion to file owners and admins.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-files',
  'feedback-files',
  true,
  20971520,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'text/plain',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload feedback files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback-files');

-- Allow public read access (files are referenced from the app)
CREATE POLICY "Public can view feedback files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'feedback-files');

-- Allow users to delete their own files (and admins)
CREATE POLICY "Users can delete own feedback files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
