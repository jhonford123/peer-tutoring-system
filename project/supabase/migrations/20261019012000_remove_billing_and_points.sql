BEGIN;

UPDATE public.books
SET is_free = true,
    price = 0;

UPDATE public.sessions
SET is_free = true,
    fee = 0;

DELETE FROM storage.objects
WHERE bucket_id = 'points-proofs';

DROP POLICY IF EXISTS "upload_own_point_proofs" ON storage.objects;
DROP POLICY IF EXISTS "read_point_proofs" ON storage.objects;
DROP POLICY IF EXISTS "delete_own_point_proofs" ON storage.objects;

DELETE FROM storage.buckets
WHERE id = 'points-proofs';

DROP TRIGGER IF EXISTS create_point_wallet_after_profile_insert ON public.profiles;

DROP FUNCTION IF EXISTS public.create_point_wallet_for_profile() CASCADE;
DROP FUNCTION IF EXISTS public.review_point_request(uuid, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.purchase_book_with_points(uuid, integer, text, text) CASCADE;

DROP TABLE IF EXISTS public.point_request_messages CASCADE;
DROP TABLE IF EXISTS public.point_requests CASCADE;
DROP TABLE IF EXISTS public.point_transactions CASCADE;
DROP TABLE IF EXISTS public.point_wallets CASCADE;
DROP TABLE IF EXISTS public.book_orders CASCADE;
DROP TABLE IF EXISTS public.payment_method_requests CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.bill_items CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;

ALTER TABLE public.books
  DROP COLUMN IF EXISTS price,
  DROP COLUMN IF EXISTS is_free;

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS fee,
  DROP COLUMN IF EXISTS is_free;

COMMIT;
