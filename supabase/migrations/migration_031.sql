-- Migration 031: Secure function to dismiss pending students
-- Allows faculty/admin to fully delete a pending student account (auth + profile)
-- without needing the service role key or CLI.
--
-- SECURITY DEFINER runs as the postgres role, which owns auth.users.
-- Deleting from auth.users cascades to profiles via ON DELETE CASCADE.

CREATE OR REPLACE FUNCTION public.delete_pending_student(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role  text;
  target_role  text;
  target_status text;
BEGIN
  -- 1. Verify caller is faculty or admin
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN ('faculty', 'admin') THEN
    RAISE EXCEPTION 'Forbidden: only faculty or admin can dismiss students';
  END IF;

  -- 2. Verify target is a pending student (never delete approved users)
  SELECT role, status INTO target_role, target_status
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF target_role != 'student' OR target_status != 'pending' THEN
    RAISE EXCEPTION 'Can only dismiss pending students';
  END IF;

  -- 3. Delete auth user — cascades to profiles and all child rows
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
