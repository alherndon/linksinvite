-- ============================================================
-- LinksInvite — eVite-style email-guest roster
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, BEFORE deploying the
-- matching code (the API now reads/writes these columns).
-- Safe to re-run: every statement is guarded.
--
-- What this enables: an owner can invite anyone by email — no
-- LinksInvite account required. When that guest taps "I'm in",
-- they land on the game roster like any registered member.
-- ============================================================

-- ── 1. Remember who each invite went to ─────────────────────
-- notification_events is the per-send record. It tracked game_id
-- and (account) user_id, but not the raw email a guest responds
-- from. Capture it so the RSVP can be attributed without an account.
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS to_name  text;

-- ── 2. Let the roster hold account-less guests ──────────────
-- game_registrations was keyed strictly to public.users. Allow a
-- row to instead identify a guest by email + display name.
ALTER TABLE public.game_registrations
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS name  text;

-- A guest row has no account, so user_id must be optional.
ALTER TABLE public.game_registrations
  ALTER COLUMN user_id DROP NOT NULL;

-- One roster row per guest email per game. Member rows keep email
-- NULL, and NULLs are distinct, so this never collides with the
-- existing (game_id, user_id) uniqueness used for members.
CREATE UNIQUE INDEX IF NOT EXISTS game_registrations_game_email_uq
  ON public.game_registrations (game_id, email);

-- ============================================================
-- Done. Now deploy (git push) so the API matches this schema.
-- ============================================================
