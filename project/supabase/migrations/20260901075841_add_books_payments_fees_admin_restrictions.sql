/*
# Add Book Selling, Payment Methods, Session Fees, and Admin Restrictions

1. New Tables: books, book_orders, payment_methods
2. Modified Tables: sessions (is_free, fee), profiles (is_first_admin)
3. Security: books/orders authenticated CRUD, payment_methods first-admin-only writes,
   profiles UPDATE restricted so only first admin can set role='admin'
4. Updated auto_approve_first_admin trigger to set is_first_admin=true
*/

-- Add columns to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0;

-- Add is_first_admin to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_first_admin boolean NOT NULL DEFAULT false;

-- Update the trigger function to also set is_first_admin
CREATE OR REPLACE FUNCTION auto_approve_first_admin()
RETURNS trigger AS $$
DECLARE
  admin_email text;
BEGIN
  SELECT email INTO admin_email FROM auth.users WHERE id = NEW.id;
  IF LOWER(admin_email) = 'matibag220@gmail.com' THEN
    NEW.role := 'admin';
    NEW.account_status := 'approved';
    NEW.is_first_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ NEW TABLE: books ============
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  description text,
  category text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 0,
  cover_image_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_books" ON books;
CREATE POLICY "select_books" ON books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_books" ON books;
CREATE POLICY "insert_books" ON books FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_books" ON books;
CREATE POLICY "update_books" ON books FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_books" ON books;
CREATE POLICY "delete_books" ON books FOR DELETE TO authenticated USING (true);

-- ============ NEW TABLE: book_orders ============
CREATE TABLE IF NOT EXISTS book_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  buyer_email text,
  quantity integer NOT NULL DEFAULT 1,
  total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE book_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_book_orders" ON book_orders;
CREATE POLICY "select_book_orders" ON book_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_book_orders" ON book_orders;
CREATE POLICY "insert_book_orders" ON book_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_book_orders" ON book_orders;
CREATE POLICY "update_book_orders" ON book_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_book_orders" ON book_orders;
CREATE POLICY "delete_book_orders" ON book_orders FOR DELETE TO authenticated USING (true);

-- ============ NEW TABLE: payment_methods ============
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  method_type text NOT NULL,
  provider text NOT NULL,
  account_number text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payment_methods" ON payment_methods;
CREATE POLICY "select_payment_methods" ON payment_methods FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_methods" ON payment_methods;
CREATE POLICY "insert_payment_methods" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_first_admin = true)
  );

DROP POLICY IF EXISTS "update_payment_methods" ON payment_methods;
CREATE POLICY "update_payment_methods" ON payment_methods FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_first_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_first_admin = true)
  );

DROP POLICY IF EXISTS "delete_payment_methods" ON payment_methods;
CREATE POLICY "delete_payment_methods" ON payment_methods FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_first_admin = true)
  );

-- ============ UPDATE PROFILES UPDATE POLICY ============
-- Only first admin can set role to 'admin'. Other admins can update everything else.
-- In RLS WITH CHECK, the new row column is referenced as the bare column name.
DROP POLICY IF EXISTS "update_profiles_admin" ON profiles;
CREATE POLICY "update_profiles_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.account_status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.account_status = 'approved'
    )
    AND (
      role <> 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.is_first_admin = true
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_book_orders_book ON book_orders(book_id);
CREATE INDEX IF NOT EXISTS idx_book_orders_status ON book_orders(status);