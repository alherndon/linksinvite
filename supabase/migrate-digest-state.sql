-- ============================================================
-- LinksInvite — digest_state table (Phase 2)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.digest_state (
  game_id             uuid        NOT NULL,
  last_sent_signature text,
  last_sent_at        timestamptz,
  night_before_sent   boolean     NOT NULL DEFAULT false,
  CONSTRAINT digest_state_pkey    PRIMARY KEY (game_id),
  CONSTRAINT digest_state_game_fk FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);
