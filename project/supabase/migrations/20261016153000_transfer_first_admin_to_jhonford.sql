BEGIN;

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = 'jhonfordlaudes17@gmail.com';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot transfer first-admin designation: jhonfordlaudes17@gmail.com does not exist in auth.users';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot transfer first-admin designation: target user has no profile';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_approve_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_email text;
BEGIN
  SELECT email INTO account_email FROM auth.users WHERE id = NEW.id;

  NEW.role := 'user';
  NEW.is_first_admin := false;

  IF LOWER(COALESCE(account_email, '')) = 'jhonfordlaudes17@gmail.com' THEN
    NEW.role := 'admin';
    NEW.account_status := 'approved';
    NEW.is_first_admin := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_permissions ON public.profiles;

UPDATE public.profiles
SET role = 'user',
    is_first_admin = false
WHERE is_first_admin = true;

UPDATE public.profiles p
SET role = 'admin',
    account_status = 'approved',
    is_first_admin = true
FROM auth.users u
WHERE u.id = p.id
  AND LOWER(u.email) = 'jhonfordlaudes17@gmail.com';

CREATE TRIGGER trg_enforce_profile_role_permissions
  BEFORE UPDATE OF role, is_first_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_permissions();

COMMIT;
