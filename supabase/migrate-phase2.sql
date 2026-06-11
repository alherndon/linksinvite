-- ============================================================
-- LinksInvite — Phase 2 Schema Migration
-- ============================================================
-- Run ONCE in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / DO-guards throughout.
-- Does NOT drop Phase 1 tables — they are renamed with a
-- _phase1 suffix so historical data is preserved.
-- ============================================================

-- ── 1. Preserve Phase 1 tables ──────────────────────────────
-- Rename the old `games` table so the new one can take its place.
-- The other Phase 1 tables (golfers, game_invitees, registrations,
-- digest_state) have distinct names and don't conflict.

DO $$
BEGIN
  -- Only act if the old games table exists and hasn't been migrated yet
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'games'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games'
      AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.games RENAME TO games_phase1;

    -- Rename constraints so their index names don't clash with the new games table
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_pkey') THEN
      ALTER TABLE public.games_phase1 RENAME CONSTRAINT games_pkey TO games_phase1_pkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_owner_id_fkey') THEN
      ALTER TABLE public.games_phase1 RENAME CONSTRAINT games_owner_id_fkey TO games_phase1_owner_id_fkey;
    END IF;

    RAISE NOTICE 'Renamed games → games_phase1 (constraints also renamed)';
  END IF;
END $$;

-- ── 2. users ─────────────────────────────────────────────────
-- Player profiles linked to Supabase Auth (auth.users).
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  first_name  text        NOT NULL DEFAULT '',
  last_name   text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',
  handicap    numeric(4,1)         DEFAULT 0,
  ghin        text                 DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ── 3. groups ────────────────────────────────────────────────
-- A group is a recurring golf crew (e.g. "Saturday Morning Gang").
CREATE TABLE IF NOT EXISTS public.groups (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text                 DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

-- ── 4. group_memberships ─────────────────────────────────────
-- role: 'superadmin' | 'admin' | 'player'
CREATE TABLE IF NOT EXISTS public.group_memberships (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL,
  user_id    uuid        NOT NULL,
  role       text        NOT NULL DEFAULT 'player'
                         CHECK (role IN ('superadmin', 'admin', 'player')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_memberships_pkey          PRIMARY KEY (id),
  CONSTRAINT group_memberships_group_fkey    FOREIGN KEY (group_id) REFERENCES public.groups(id)  ON DELETE CASCADE,
  CONSTRAINT group_memberships_user_fkey     FOREIGN KEY (user_id)  REFERENCES public.users(id)   ON DELETE CASCADE,
  CONSTRAINT group_memberships_group_user_uq UNIQUE (group_id, user_id)
);

-- ── 5. locations ─────────────────────────────────────────────
-- Golf courses / venues tied to a group.
CREATE TABLE IF NOT EXISTS public.locations (
  location_id      uuid        NOT NULL DEFAULT gen_random_uuid(),
  group_id         uuid        NOT NULL,
  name             text        NOT NULL,
  address          text                 DEFAULT '',
  tee_time_contact jsonb                DEFAULT '{"name":"","email":"","phone":""}',
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey     PRIMARY KEY (location_id),
  CONSTRAINT locations_group_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- ── 6. games ─────────────────────────────────────────────────
-- Individual game events. Soft-deleted via is_active = false.
CREATE TABLE IF NOT EXISTS public.games (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  group_id         uuid        NOT NULL,
  location_id      uuid,
  day_of_week      text                 DEFAULT '',
  scheduled_date   date,
  first_tee_time   time,
  description      text                 DEFAULT '',
  rules            text                 DEFAULT '',
  max_players      integer     NOT NULL DEFAULT 16,
  pairing_method   text        NOT NULL DEFAULT 'balanced',
  assign_players   boolean     NOT NULL DEFAULT false,
  recurring        boolean     NOT NULL DEFAULT false,
  recurrence       jsonb,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_pkey          PRIMARY KEY (id),
  CONSTRAINT games_group_fk      FOREIGN KEY (group_id)    REFERENCES public.groups(id)    ON DELETE CASCADE,
  CONSTRAINT games_location_fk   FOREIGN KEY (location_id) REFERENCES public.locations(location_id)
);

-- ── 7. game_registrations ────────────────────────────────────
-- status: 'registered' | 'waitlisted'
-- position: waitlist ordering (null for registered players)
CREATE TABLE IF NOT EXISTS public.game_registrations (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  game_id       uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  status        text        NOT NULL DEFAULT 'registered'
                            CHECK (status IN ('registered', 'waitlisted')),
  position      integer,
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_registrations_pkey        PRIMARY KEY (id),
  CONSTRAINT game_registrations_game_fk     FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT game_registrations_user_fk     FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT game_registrations_game_user_uq UNIQUE (game_id, user_id)
);

-- ── 8. notification_events ───────────────────────────────────
-- Tracks every email sent via the token-based invite flow.
CREATE TABLE IF NOT EXISTS public.notification_events (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  group_id            uuid,
  game_id             uuid,
  user_id             uuid,
  event_type          text        NOT NULL DEFAULT 'invite',
  response_token_hash text,
  responded_at        timestamptz,
  response_status     text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_pkey     PRIMARY KEY (id),
  CONSTRAINT notification_events_group_fk FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT notification_events_game_fk  FOREIGN KEY (game_id)  REFERENCES public.games(id),
  CONSTRAINT notification_events_user_fk  FOREIGN KEY (user_id)  REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_token_idx
  ON public.notification_events (response_token_hash)
  WHERE response_token_hash IS NOT NULL;

-- ── 9. tee_time_requests ─────────────────────────────────────
-- Tracks pro-shop email requests sent by admins.
CREATE TABLE IF NOT EXISTS public.tee_time_requests (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  game_id              uuid        NOT NULL,
  to_pro_shop_name     text                 DEFAULT '',
  to_pro_shop_email    text                 DEFAULT '',
  requested_time       timestamptz,
  response_token_hash  text,
  status               text        NOT NULL DEFAULT 'pending',
  response             jsonb,
  sent_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tee_time_requests_pkey    PRIMARY KEY (id),
  CONSTRAINT tee_time_requests_game_fk FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

-- ── 10. Helpful indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_memberships_user    ON public.group_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group   ON public.group_memberships (group_id);
CREATE INDEX IF NOT EXISTS idx_games_group               ON public.games (group_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_games_scheduled_date      ON public.games (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_game_registrations_game   ON public.game_registrations (game_id);
CREATE INDEX IF NOT EXISTS idx_game_registrations_user   ON public.game_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_locations_group           ON public.locations (group_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_events_token ON public.notification_events (response_token_hash);

-- ── 11. Auto-provision user profile on sign-up ───────────────
-- When a new auth.users row is created, insert a matching
-- public.users row so the app always has a profile to read.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Done. Next step: run rls-policies.sql to lock down access.
-- ============================================================
