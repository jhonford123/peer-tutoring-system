CREATE TABLE IF NOT EXISTS public.point_wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.point_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_requested integer NOT NULL CHECK (points_requested > 0 AND points_requested % 5 = 0),
  reference_number text NOT NULL,
  proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(reference_number)) > 0),
  CHECK (proof_path LIKE requester_id::text || '/%')
);

CREATE TABLE IF NOT EXISTS public.point_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.point_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_change integer NOT NULL CHECK (points_change <> 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('admin_release', 'book_purchase', 'admin_adjustment')),
  request_id uuid REFERENCES public.point_requests(id) ON DELETE SET NULL,
  note text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_requests_owner_created
  ON public.point_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_requests_status_created
  ON public.point_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_messages_request_created
  ON public.point_request_messages(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_owner_created
  ON public.point_transactions(user_id, created_at DESC);

INSERT INTO public.point_wallets (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_point_wallet_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.point_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_point_wallet_after_profile_insert ON public.profiles;
CREATE TRIGGER create_point_wallet_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_point_wallet_for_profile();

ALTER TABLE public.point_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_point_wallets" ON public.point_wallets;
CREATE POLICY "select_point_wallets" ON public.point_wallets
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "select_point_requests" ON public.point_requests;
CREATE POLICY "select_point_requests" ON public.point_requests
  FOR SELECT TO authenticated USING (
    requester_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "insert_point_requests" ON public.point_requests;
CREATE POLICY "insert_point_requests" ON public.point_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND points_requested > 0
    AND points_requested % 5 = 0
    AND EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'points-proofs' AND o.name = proof_path
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "select_point_request_messages" ON public.point_request_messages;
CREATE POLICY "select_point_request_messages" ON public.point_request_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.point_requests r
      WHERE r.id = request_id
        AND (
          r.requester_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
          )
        )
    )
  );

DROP POLICY IF EXISTS "insert_point_request_messages" ON public.point_request_messages;
CREATE POLICY "insert_point_request_messages" ON public.point_request_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.point_requests r
      WHERE r.id = request_id
        AND r.status = 'pending'
        AND (
          r.requester_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
          )
        )
    )
  );

DROP POLICY IF EXISTS "select_point_transactions" ON public.point_transactions;
CREATE POLICY "select_point_transactions" ON public.point_transactions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('points-proofs', 'points-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "upload_own_point_proofs" ON storage.objects;
CREATE POLICY "upload_own_point_proofs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'points-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "read_point_proofs" ON storage.objects;
CREATE POLICY "read_point_proofs" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'points-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_point_proofs" ON storage.objects;
CREATE POLICY "delete_own_point_proofs" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'points-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.review_point_request(
  p_request_id uuid,
  p_release boolean,
  p_review_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.point_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only an approved admin can review point requests';
  END IF;

  SELECT * INTO v_request
  FROM public.point_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending point request not found';
  END IF;

  IF p_release THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.point_request_messages m
      WHERE m.request_id = v_request.id AND m.sender_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Send a chat message to the requester before releasing points';
    END IF;

    INSERT INTO public.point_wallets (user_id) VALUES (v_request.requester_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.point_wallets
    SET balance = balance + v_request.points_requested,
        updated_at = now()
    WHERE user_id = v_request.requester_id;

    INSERT INTO public.point_transactions (user_id, points_change, transaction_type, request_id, note, actor_id)
    VALUES (
      v_request.requester_id,
      v_request.points_requested,
      'admin_release',
      v_request.id,
      'Points request released by admin',
      auth.uid()
    );
  END IF;

  UPDATE public.point_requests
  SET status = CASE WHEN p_release THEN 'released' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = NULLIF(btrim(p_review_note), '')
  WHERE id = v_request.id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_point_request(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_point_request(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_book_with_points(
  p_book_id uuid,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book public.books%ROWTYPE;
  v_price integer;
  v_order_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'An approved account is required to purchase books';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR NULLIF(btrim(p_buyer_name), '') IS NULL THEN
    RAISE EXCEPTION 'A valid quantity and buyer name are required';
  END IF;

  SELECT * INTO v_book
  FROM public.books
  WHERE id = p_book_id
  FOR UPDATE;

  IF NOT FOUND OR v_book.status NOT IN ('approved', 'published') OR v_book.cover_image_url IS NULL THEN
    RAISE EXCEPTION 'This book is not available for purchase';
  END IF;
  IF v_book.stock < p_quantity THEN
    RAISE EXCEPTION 'Not enough book stock';
  END IF;
  IF v_book.is_free AND p_quantity <> 1 THEN
    RAISE EXCEPTION 'Only one free copy may be purchased at a time';
  END IF;

  v_price := CASE WHEN v_book.is_free THEN 0 ELSE round(v_book.price * p_quantity)::integer END;

  IF v_price > 0 THEN
    UPDATE public.point_wallets
    SET balance = balance - v_price,
        updated_at = now()
    WHERE user_id = auth.uid()
      AND balance >= v_price;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient points balance';
    END IF;

    INSERT INTO public.point_transactions (user_id, points_change, transaction_type, note, actor_id)
    VALUES (auth.uid(), -v_price, 'book_purchase', 'Purchased book: ' || v_book.title, auth.uid());
  END IF;

  UPDATE public.books SET stock = stock - p_quantity WHERE id = p_book_id;

  INSERT INTO public.book_orders (book_id, buyer_name, buyer_email, quantity, total_price, status)
  VALUES (p_book_id, btrim(p_buyer_name), NULLIF(btrim(p_buyer_email), ''), p_quantity, v_price, 'paid')
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_book_with_points(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_book_with_points(uuid, integer, text, text) TO authenticated;

DROP POLICY IF EXISTS "insert_book_orders" ON public.book_orders;

UPDATE public.books SET price = round(price * 5);
UPDATE public.sessions SET fee = round(fee * 5);
UPDATE public.bill_items
SET unit_price = round(unit_price * 5),
    subtotal = round(subtotal * 5);
UPDATE public.bills SET amount = round(amount * 5);
UPDATE public.book_orders SET total_price = round(total_price * 5);

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_price_points_integer_check;
ALTER TABLE public.books
  ADD CONSTRAINT books_price_points_integer_check CHECK (price >= 0 AND price = trunc(price));

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_fee_points_integer_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_fee_points_integer_check CHECK (fee >= 0 AND fee = trunc(fee));

ALTER TABLE public.bill_items
  DROP CONSTRAINT IF EXISTS bill_items_points_integer_check;
ALTER TABLE public.bill_items
  ADD CONSTRAINT bill_items_points_integer_check CHECK (
    unit_price >= 0 AND unit_price = trunc(unit_price)
    AND subtotal >= 0 AND subtotal = trunc(subtotal)
  );

ALTER TABLE public.bills
  DROP CONSTRAINT IF EXISTS bills_amount_points_integer_check;
ALTER TABLE public.bills
  ADD CONSTRAINT bills_amount_points_integer_check CHECK (amount >= 0 AND amount = trunc(amount));

ALTER TABLE public.book_orders
  DROP CONSTRAINT IF EXISTS book_orders_total_price_points_integer_check;
ALTER TABLE public.book_orders
  ADD CONSTRAINT book_orders_total_price_points_integer_check CHECK (
    total_price >= 0 AND total_price = trunc(total_price)
  );
