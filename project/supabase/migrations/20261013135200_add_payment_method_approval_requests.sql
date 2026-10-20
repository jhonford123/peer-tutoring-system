CREATE TABLE IF NOT EXISTS public.payment_method_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid,
  action text NOT NULL CHECK (action IN ('add', 'update', 'delete')),
  account_name text,
  method_type text,
  provider text,
  account_number text,
  is_default boolean,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_method_request_payload_check CHECK (
    (action = 'delete' AND payment_method_id IS NOT NULL)
    OR
    (action IN ('add', 'update') AND account_name IS NOT NULL AND method_type IS NOT NULL AND provider IS NOT NULL)
  ),
  CONSTRAINT payment_method_request_target_check CHECK (
    (action = 'add' AND payment_method_id IS NULL)
    OR (action IN ('update', 'delete') AND payment_method_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_method_requests_status_created
  ON public.payment_method_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_method_requests_requester
  ON public.payment_method_requests(requested_by, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_method_requests_pending_method
  ON public.payment_method_requests(payment_method_id)
  WHERE status = 'pending' AND payment_method_id IS NOT NULL;

ALTER TABLE public.payment_method_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payment_method_requests" ON public.payment_method_requests;
CREATE POLICY "select_payment_method_requests" ON public.payment_method_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "insert_payment_method_requests" ON public.payment_method_requests;
CREATE POLICY "insert_payment_method_requests" ON public.payment_method_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_status = 'approved'
    )
  );

CREATE OR REPLACE FUNCTION public.review_payment_method_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.payment_method_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only an approved admin can review payment method requests';
  END IF;

  SELECT * INTO v_request
  FROM public.payment_method_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending payment method request not found';
  END IF;

  IF p_approve THEN
    LOCK TABLE public.payment_methods IN SHARE ROW EXCLUSIVE MODE;

    IF v_request.action = 'add' THEN
      IF COALESCE(v_request.is_default, false) THEN
        UPDATE public.payment_methods SET is_default = false WHERE is_default;
      END IF;
      INSERT INTO public.payment_methods (account_name, method_type, provider, account_number, is_default)
      VALUES (v_request.account_name, v_request.method_type, v_request.provider, v_request.account_number, COALESCE(v_request.is_default, false));
    ELSIF v_request.action = 'update' THEN
      IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE id = v_request.payment_method_id) THEN
        RAISE EXCEPTION 'Payment method no longer exists';
      END IF;
      IF COALESCE(v_request.is_default, false) THEN
        UPDATE public.payment_methods SET is_default = false
        WHERE is_default AND id <> v_request.payment_method_id;
      END IF;
      UPDATE public.payment_methods
      SET account_name = v_request.account_name,
          method_type = v_request.method_type,
          provider = v_request.provider,
          account_number = v_request.account_number,
          is_default = COALESCE(v_request.is_default, false)
      WHERE id = v_request.payment_method_id;
    ELSIF v_request.action = 'delete' THEN
      DELETE FROM public.payment_methods WHERE id = v_request.payment_method_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment method no longer exists';
      END IF;
    END IF;
  END IF;

  UPDATE public.payment_method_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = NULLIF(btrim(p_review_note), '')
  WHERE id = v_request.id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_payment_method_request(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_payment_method_request(uuid, boolean, text) TO authenticated;
