/*
  # Driver Bug Tracker — New Independent Module

  ## Summary
  Creates a fully standalone bug tracking system. No existing tables are modified.
  All new tables are prefixed to avoid collisions with existing schema.

  ## New Tables

  ### driver_bugs
  Core bug record. Each row is one reported bug/issue.
  - id: uuid primary key
  - bug_number: auto-incrementing integer for human-readable Bug ID (BUG-001)
  - title: short summary
  - description: rich text (HTML) detailed description
  - status: New | Open | In Progress | Testing | Resolved | Closed | Deferred | Duplicate | Rejected
  - priority: Low | Medium | High | Urgent
  - severity: Minor | Major | Critical | Blocker
  - reproducibility: Always | Often | Sometimes | Rarely | Unable | N/A
  - software_version: affected software version string
  - build_version: specific build
  - affected_module: which module is affected
  - affected_driver: which driver is affected
  - operating_system: OS info
  - browser: browser info
  - expected_behavior: text
  - actual_behavior: text
  - steps_to_reproduce: text
  - workaround: text
  - additional_notes: text
  - reporter_id: FK to profiles
  - assigned_to_id: FK to profiles (nullable)
  - assigned_at: timestamp when assigned
  - due_date: target resolution date
  - resolved_at: timestamp when resolved/closed
  - created_at / updated_at: timestamps

  ### bug_comments
  Threaded comments on bugs.
  - id, bug_id, author_id, body (HTML rich text), created_at, updated_at

  ### bug_attachments
  Files and images attached to bugs or comments.
  - id, bug_id, comment_id (nullable - top-level or on comment), uploader_id
  - file_name, file_size, mime_type, storage_path, created_at

  ### bug_history
  Immutable audit trail for every change.
  - id, bug_id, changed_by_id, field_name, old_value, new_value, changed_at

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read all bugs and create new ones
  - Users can edit/delete only their own bugs (unless admin)
  - Admins can edit any bug, assign, change status, close
  - Comments: users can create; can only update/delete own; admins can delete any
  - History: read-only via policy; inserts done by application
  - Attachments: authenticated users can upload; owner or admin can delete
*/

-- ============================================================
-- SEQUENCES & TABLES
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS driver_bug_number_seq START 1;

CREATE TABLE IF NOT EXISTS driver_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_number integer UNIQUE NOT NULL DEFAULT nextval('driver_bug_number_seq'),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New','Open','In Progress','Testing','Resolved','Closed','Deferred','Duplicate','Rejected')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  severity text NOT NULL DEFAULT 'Major' CHECK (severity IN ('Minor','Major','Critical','Blocker')),
  reproducibility text NOT NULL DEFAULT 'N/A' CHECK (reproducibility IN ('Always','Often','Sometimes','Rarely','Unable','N/A')),
  software_version text NOT NULL DEFAULT '',
  build_version text NOT NULL DEFAULT '',
  affected_module text NOT NULL DEFAULT '',
  affected_driver text NOT NULL DEFAULT '',
  operating_system text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  expected_behavior text NOT NULL DEFAULT '',
  actual_behavior text NOT NULL DEFAULT '',
  steps_to_reproduce text NOT NULL DEFAULT '',
  workaround text NOT NULL DEFAULT '',
  additional_notes text NOT NULL DEFAULT '',
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  due_date date,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES driver_bugs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bug_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES driver_bugs(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES bug_comments(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES driver_bugs(id) ON DELETE CASCADE,
  changed_by_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_driver_bugs_reporter ON driver_bugs(reporter_id);
CREATE INDEX IF NOT EXISTS idx_driver_bugs_assigned ON driver_bugs(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_driver_bugs_status ON driver_bugs(status);
CREATE INDEX IF NOT EXISTS idx_driver_bugs_priority ON driver_bugs(priority);
CREATE INDEX IF NOT EXISTS idx_driver_bugs_created ON driver_bugs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_attachments_bug ON bug_attachments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_history_bug ON bug_history(bug_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE driver_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_history ENABLE ROW LEVEL SECURITY;

-- driver_bugs policies
CREATE POLICY "Authenticated users can view all bugs"
  ON driver_bugs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bugs"
  ON driver_bugs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can update own bugs or admins can update any"
  ON driver_bugs FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = reporter_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = reporter_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete bugs"
  ON driver_bugs FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- bug_comments policies
CREATE POLICY "Authenticated users can view all comments"
  ON bug_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON bug_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments"
  ON bug_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments or admins any"
  ON bug_comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- bug_attachments policies
CREATE POLICY "Authenticated users can view all attachments"
  ON bug_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload attachments"
  ON bug_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Uploader or admin can delete attachments"
  ON bug_attachments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = uploader_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- bug_history policies
CREATE POLICY "Authenticated users can view bug history"
  ON bug_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert history entries"
  ON bug_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by_id);
