-- Notification Center — independent module

-- Event type enum values stored as text
-- notification_subscriptions: per-user, per-event configuration
CREATE TABLE notification_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  frequency     text NOT NULL DEFAULT 'immediate', -- immediate | daily | weekly
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type)
);

-- notification_logs: record of every notification dispatched
CREATE TABLE notification_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  event_id      text,                               -- id of the triggering entity
  subject       text NOT NULL DEFAULT '',
  body_html     text NOT NULL DEFAULT '',
  recipients    text[] NOT NULL DEFAULT '{}',       -- array of email addresses
  status        text NOT NULL DEFAULT 'pending',    -- pending | sent | failed | skipped
  error_message text,
  triggered_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_notification_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_notification_subscriptions_updated_at
  BEFORE UPDATE ON notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_notification_subscription_updated_at();

-- RLS
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users manage their own; admins manage all
CREATE POLICY "ns_select_own" ON notification_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ns_insert_own" ON notification_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ns_update_own" ON notification_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ns_delete_own" ON notification_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read/write any subscription
CREATE POLICY "ns_admin_select" ON notification_subscriptions FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ns_admin_insert" ON notification_subscriptions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ns_admin_update" ON notification_subscriptions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ns_admin_delete" ON notification_subscriptions FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Notification logs: admins only for write; authenticated read their own
CREATE POLICY "nl_admin_select" ON notification_logs FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "nl_admin_insert" ON notification_logs FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "nl_admin_update" ON notification_logs FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "nl_admin_delete" ON notification_logs FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
