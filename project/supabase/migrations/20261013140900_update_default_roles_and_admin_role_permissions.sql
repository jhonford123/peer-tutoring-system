ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

UPDATE public.profiles
SET role = 'user'
WHERE role IS DISTINCT FROM 'admin';

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

  IF LOWER(COALESCE(account_email, '')) = 'matibag220@gmail.com' THEN
    NEW.role := 'admin';
    NEW.account_status := 'approved';
    NEW.is_first_admin := true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
BEGIN
  IF NEW.is_first_admin IS DISTINCT FROM OLD.is_first_admin THEN
    RAISE EXCEPTION 'The first-admin designation cannot be changed';
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR actor.role <> 'admin' OR actor.account_status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved admin can change user roles';
  END IF;

  IF NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'Admins cannot change their own role';
  END IF;

  IF OLD.is_first_admin THEN
    RAISE EXCEPTION 'The first admin role cannot be changed';
  END IF;

  IF OLD.account_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved accounts can have their role changed';
  END IF;

  IF NEW.role NOT IN ('user', 'staff', 'tutor', 'admin') THEN
    RAISE EXCEPTION 'Unsupported profile role';
  END IF;

  IF actor.is_first_admin THEN
    IF OLD.is_first_admin THEN
      RAISE EXCEPTION 'Admin1 cannot change their own role';
    END IF;
  ELSE
    IF OLD.role = 'admin' OR NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Only admin1 can promote or demote admin accounts';
    END IF;
    IF NEW.role NOT IN ('user', 'staff', 'tutor') THEN
      RAISE EXCEPTION 'Regular admins can only assign user, staff, or tutor roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_permissions ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role_permissions
  BEFORE UPDATE OF role, is_first_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_permissions();

DROP POLICY IF EXISTS "update_profiles_admin" ON public.profiles;
CREATE POLICY "update_profiles_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.account_status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.account_status = 'approved'
    )
  );
