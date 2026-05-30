/*
  # Create bug-attachments storage bucket

  Creates a private storage bucket for Driver Bug Tracker file attachments.
  Authenticated users can upload; only uploaders or admins can delete.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-attachments', 'bug-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload bug attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bug-attachments');

-- Allow authenticated users to view/download
CREATE POLICY "Authenticated users can view bug attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bug-attachments');

-- Allow uploader or admin to delete
CREATE POLICY "Uploader or admin can delete bug attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bug-attachments' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
