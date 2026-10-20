CREATE TABLE IF NOT EXISTS public.role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('staff', 'tutor')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT role_change_review_metadata_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_change_requests_one_pending_per_user
  ON public.role_change_requests (requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_role_change_requests_pending_created_at
  ON public.role_change_requests (created_at)
  WHERE status = 'pending';

ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_or_admin_role_change_requests"
  ON public.role_change_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
    )
  );

CREATE POLICY "insert_own_role_change_requests"
  ON public.role_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_status = 'approved'
        AND p.role <> 'admin'
        AND p.role <> requested_role
    )
  );

CREATE OR REPLACE FUNCTION public.review_role_change_request(p_request_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  role_request public.role_change_requests%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO actor
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR actor.role <> 'admin' OR actor.account_status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved admin can review role change requests';
  END IF;

  SELECT * INTO role_request
  FROM public.role_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR role_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Role change request is not pending';
  END IF;

  IF p_approve THEN
    SELECT * INTO target_profile
    FROM public.profiles
    WHERE id = role_request.requester_id
    FOR UPDATE;

    IF NOT FOUND OR target_profile.account_status <> 'approved'
      OR target_profile.role = 'admin'
      OR target_profile.is_first_admin
      OR target_profile.role = role_request.requested_role THEN
      RAISE EXCEPTION 'The requested role change is no longer valid';
    END IF;

    UPDATE public.profiles
    SET role = role_request.requested_role
    WHERE id = role_request.requester_id;
  END IF;

  UPDATE public.role_change_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = role_request.id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_role_change_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_role_change_request(uuid, boolean) TO authenticated;
