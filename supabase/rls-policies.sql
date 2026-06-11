-- ============================================================
-- LinksInvite — Row Level Security Policies
-- ============================================================
-- Run once in the Supabase SQL Editor for each environment.
-- Safe to re-run: drops existing policies before recreating them.
-- All server-side API routes use the service-role key and
-- bypass RLS intentionally. These policies protect direct
-- browser (anon-key) calls only.
-- ============================================================

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tee_time_requests   ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies (idempotent reset) ────────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename IN (
        'users','groups','group_memberships','games',
        'game_registrations','locations',
        'notification_events','tee_time_requests'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- users
-- Users see their own row and any co-member's row.
-- Users can only insert or update their own row.
-- ============================================================
CREATE POLICY "users: own row"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users: co-members"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.group_memberships a
      JOIN   public.group_memberships b ON b.group_id = a.group_id
      WHERE  a.user_id = auth.uid()
        AND  b.user_id = public.users.id
    )
  );

CREATE POLICY "users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- groups
-- Members see their groups. Admins (superadmin or admin) can
-- update group metadata. INSERT goes through the onboard API
-- (service role) so no client INSERT policy is needed.
-- ============================================================
CREATE POLICY "groups: member select"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.groups.id
        AND user_id  = auth.uid()
    )
  );

CREATE POLICY "groups: admin update"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.groups.id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- group_memberships
-- Any member of a group sees all memberships in that group.
-- Admins can add new members.
-- Only superadmins can change or remove memberships (they
-- cannot remove themselves to prevent locking out a group).
-- ============================================================
CREATE POLICY "memberships: group member select"
  ON public.group_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_memberships gm2
      WHERE gm2.group_id = public.group_memberships.group_id
        AND gm2.user_id  = auth.uid()
    )
  );

CREATE POLICY "memberships: admin insert"
  ON public.group_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_memberships gm2
      WHERE gm2.group_id = public.group_memberships.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "memberships: superadmin update"
  ON public.group_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships gm2
      WHERE gm2.group_id = public.group_memberships.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role = 'superadmin'
    )
  );

CREATE POLICY "memberships: superadmin delete"
  ON public.group_memberships FOR DELETE
  USING (
    public.group_memberships.user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_memberships gm2
      WHERE gm2.group_id = public.group_memberships.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role = 'superadmin'
    )
  );

-- ============================================================
-- games
-- Members see all active games for their groups.
-- Admins (superadmin or admin) can create and update games.
-- Soft-delete (is_active = false) goes through the UPDATE
-- policy — a player cannot soft-delete a game.
-- ============================================================
CREATE POLICY "games: member select"
  ON public.games FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.games.group_id
        AND user_id  = auth.uid()
    )
  );

CREATE POLICY "games: admin insert"
  ON public.games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.games.group_id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "games: admin update"
  ON public.games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.games.group_id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- game_registrations
-- Any group member sees all registrations for games in their
-- group. Players register only themselves. Admins can register
-- or remove anyone in their group.
-- ============================================================
CREATE POLICY "regs: member select"
  ON public.game_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.game_registrations.game_id
        AND  gm.user_id = auth.uid()
    )
  );

CREATE POLICY "regs: self insert"
  ON public.game_registrations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.game_registrations.game_id
        AND  gm.user_id = auth.uid()
    )
  );

CREATE POLICY "regs: self or admin update"
  ON public.game_registrations FOR UPDATE
  USING (
    public.game_registrations.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.game_registrations.game_id
        AND  gm.user_id = auth.uid()
        AND  gm.role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "regs: self or admin delete"
  ON public.game_registrations FOR DELETE
  USING (
    public.game_registrations.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.game_registrations.game_id
        AND  gm.user_id = auth.uid()
        AND  gm.role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- locations
-- Members see active locations in their groups.
-- Admins can insert, update, and soft-delete locations.
-- ============================================================
CREATE POLICY "locations: member select"
  ON public.locations FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.locations.group_id
        AND user_id  = auth.uid()
    )
  );

CREATE POLICY "locations: admin write"
  ON public.locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.locations.group_id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.locations.group_id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- notification_events
-- All writes go through API routes using the service-role key.
-- Only group admins need to read notification history (for the
-- tee-time request status panel in Admin).
-- ============================================================
CREATE POLICY "notifications: admin select"
  ON public.notification_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = public.notification_events.group_id
        AND user_id  = auth.uid()
        AND role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- tee_time_requests
-- Only group admins can view and send tee-time requests.
-- ============================================================
CREATE POLICY "ttr: admin select"
  ON public.tee_time_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.tee_time_requests.game_id
        AND  gm.user_id = auth.uid()
        AND  gm.role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "ttr: admin insert"
  ON public.tee_time_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.tee_time_requests.game_id
        AND  gm.user_id = auth.uid()
        AND  gm.role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "ttr: admin update"
  ON public.tee_time_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.games g
      JOIN   public.group_memberships gm ON gm.group_id = g.group_id
      WHERE  g.id       = public.tee_time_requests.game_id
        AND  gm.user_id = auth.uid()
        AND  gm.role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- Multi-owner summary
-- ============================================================
-- role = 'superadmin'  Full control: manage members, roles,
--                      group settings, games, locations.
-- role = 'admin'       Can create/edit/cancel games and
--                      locations. Cannot manage memberships
--                      or group settings.
-- role = 'player'      Can register/unregister for games.
--                      Read-only access to everything else.
--
-- A group may have any number of superadmins and admins.
-- Promote via Admin → Members & Roles → Make Owner (superadmin)
-- or the role dropdown (admin).
-- ============================================================
