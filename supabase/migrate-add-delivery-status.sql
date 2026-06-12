-- ============================================================
-- LinksInvite — Add email delivery tracking to notification_events
-- ============================================================
-- Run ONCE in the Supabase SQL Editor.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS throughout.
-- ============================================================

-- provider_message_id: the ID returned by Resend/Postmark when an
-- email is sent. Used to match incoming webhook events back to the
-- notification_events row that triggered the send.
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status     text;

CREATE INDEX IF NOT EXISTS idx_notification_events_provider_msg
  ON public.notification_events (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
