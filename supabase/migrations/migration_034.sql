-- Migration 034: Fix admin RLS policies
--
-- migration_033 checked profiles.role = 'admin' but admin role is stored
-- in institution_members.role, not profiles. Drop and replace.
-- Also adds admin DELETE policy for announcements (currently only the
-- original poster can delete, blocking admins from moderating content).

-- ── 1. Fix institution_members INSERT policy ───────────────────────────────────

DROP POLICY IF EXISTS "Admins can add institution members" ON public.institution_members;

CREATE POLICY "Admins can add institution members"
  ON public.institution_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.institution_members existing
      WHERE existing.user_id = auth.uid()
        AND existing.role = 'admin'
        AND existing.institution_id = institution_id
    )
  );

-- ── 2. Admins can delete any announcement in their institution ─────────────────

CREATE POLICY "Admins can delete any announcement"
  ON public.announcements FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
