/*
# Peer Tutoring and Academic Support System — Schema

## Overview
Creates the complete database schema for a web-based peer tutoring and academic support
system for Bestlink College of the Philippines. The system manages tutors, tutoring
sessions, academic subjects, inventory/stock of learning materials, and a billing
service with confirmation flow.

## New Tables

### 1. subjects
- `id` (uuid, primary key)
- `code` (text, unique, not null) — e.g. "MATH101"
- `name` (text, not null) — e.g. "College Algebra"
- `department` (text, not null) — e.g. "Mathematics"
- `description` (text)
- `created_at` (timestamptz)

### 2. tutors
- `id` (uuid, primary key)
- `name` (text, not null)
- `email` (text)
- `phone` (text)
- `department` (text)
- `year_level` (text) — e.g. "3rd Year"
- `status` (text, default 'active') — 'active' | 'inactive'
- `rating` (numeric, default 5.0)
- `created_at` (timestamptz)

### 3. tutor_subjects
- `id` (uuid, primary key)
- `tutor_id` (uuid, FK → tutors)
- `subject_id` (uuid, FK → subjects)
- Unique constraint on (tutor_id, subject_id)

### 4. sessions
- `id` (uuid, primary key)
- `tutor_id` (uuid, FK → tutors)
- `subject_id` (uuid, FK → subjects)
- `student_name` (text, not null)
- `student_email` (text)
- `session_date` (date, not null)
- `start_time` (time, not null)
- `end_time` (time, not null)
- `location` (text) — e.g. "Library Room 2"
- `status` (text, default 'scheduled') — 'scheduled' | 'completed' | 'cancelled'
- `notes` (text)
- `created_at` (timestamptz)

### 5. inventory_items
- `id` (uuid, primary key)
- `name` (text, not null)
- `category` (text, not null) — e.g. "Textbook", "Study Guide", "Lab Equipment"
- `quantity` (integer, not null, default 0)
- `unit` (text, default 'pcs')
- `condition_status` (text, default 'good') — 'new' | 'good' | 'fair' | 'damaged'
- `location` (text) — storage location
- `created_at` (timestamptz)

### 6. inventory_transactions
- `id` (uuid, primary key)
- `item_id` (uuid, FK → inventory_items)
- `transaction_type` (text, not null) — 'stock_in' | 'stock_out' | 'adjustment'
- `quantity` (integer, not null)
- `reason` (text)
- `created_at` (timestamptz)

### 7. bills
- `id` (uuid, primary key)
- `bill_number` (text, unique, not null) — generated bill number
- `student_name` (text, not null)
- `student_email` (text)
- `session_id` (uuid, FK → sessions, nullable)
- `description` (text, not null)
- `amount` (numeric, not null, default 0)
- `status` (text, default 'pending') — 'pending' | 'confirmed' | 'paid' | 'cancelled'
- `due_date` (date)
- `created_at` (timestamptz)

### 8. bill_items
- `id` (uuid, primary key)
- `bill_id` (uuid, FK → bills ON DELETE CASCADE)
- `description` (text, not null)
- `quantity` (integer, not null, default 1)
- `unit_price` (numeric, not null, default 0)
- `subtotal` (numeric, not null, default 0)

## Security
- RLS enabled on all tables.
- Single-tenant (no auth): all policies use `TO anon, authenticated` with `USING (true)`
  because the data is intentionally shared/public within the institution.
*/

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  department text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_subjects" ON subjects;
CREATE POLICY "anon_crud_subjects" ON subjects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_subjects" ON subjects;
CREATE POLICY "anon_insert_subjects" ON subjects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_subjects" ON subjects;
CREATE POLICY "anon_update_subjects" ON subjects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_subjects" ON subjects;
CREATE POLICY "anon_delete_subjects" ON subjects FOR DELETE TO anon, authenticated USING (true);

-- Tutors
CREATE TABLE IF NOT EXISTS tutors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  department text,
  year_level text,
  status text NOT NULL DEFAULT 'active',
  rating numeric DEFAULT 5.0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tutors" ON tutors;
CREATE POLICY "anon_select_tutors" ON tutors FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tutors" ON tutors;
CREATE POLICY "anon_insert_tutors" ON tutors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tutors" ON tutors;
CREATE POLICY "anon_update_tutors" ON tutors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tutors" ON tutors;
CREATE POLICY "anon_delete_tutors" ON tutors FOR DELETE TO anon, authenticated USING (true);

-- Tutor-Subjects (many-to-many)
CREATE TABLE IF NOT EXISTS tutor_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (tutor_id, subject_id)
);
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tutor_subjects" ON tutor_subjects;
CREATE POLICY "anon_select_tutor_subjects" ON tutor_subjects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tutor_subjects" ON tutor_subjects;
CREATE POLICY "anon_insert_tutor_subjects" ON tutor_subjects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tutor_subjects" ON tutor_subjects;
CREATE POLICY "anon_update_tutor_subjects" ON tutor_subjects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tutor_subjects" ON tutor_subjects;
CREATE POLICY "anon_delete_tutor_subjects" ON tutor_subjects FOR DELETE TO anon, authenticated USING (true);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_email text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon, authenticated USING (true);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  condition_status text NOT NULL DEFAULT 'good',
  location text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_inventory" ON inventory_items;
CREATE POLICY "anon_select_inventory" ON inventory_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory_items;
CREATE POLICY "anon_insert_inventory" ON inventory_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_inventory" ON inventory_items;
CREATE POLICY "anon_update_inventory" ON inventory_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory_items;
CREATE POLICY "anon_delete_inventory" ON inventory_items FOR DELETE TO anon, authenticated USING (true);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_inv_trans" ON inventory_transactions;
CREATE POLICY "anon_select_inv_trans" ON inventory_transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_inv_trans" ON inventory_transactions;
CREATE POLICY "anon_insert_inv_trans" ON inventory_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_inv_trans" ON inventory_transactions;
CREATE POLICY "anon_delete_inv_trans" ON inventory_transactions FOR DELETE TO anon, authenticated USING (true);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE NOT NULL,
  student_name text NOT NULL,
  student_email text,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bills" ON bills;
CREATE POLICY "anon_select_bills" ON bills FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bills" ON bills;
CREATE POLICY "anon_insert_bills" ON bills FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bills" ON bills;
CREATE POLICY "anon_update_bills" ON bills FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bills" ON bills;
CREATE POLICY "anon_delete_bills" ON bills FOR DELETE TO anon, authenticated USING (true);

-- Bill Items
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0
);
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bill_items" ON bill_items;
CREATE POLICY "anon_select_bill_items" ON bill_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bill_items" ON bill_items;
CREATE POLICY "anon_insert_bill_items" ON bill_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bill_items" ON bill_items;
CREATE POLICY "anon_delete_bill_items" ON bill_items FOR DELETE TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_tutor ON sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_tutor_subjects_tutor ON tutor_subjects(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_subjects_subject ON tutor_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);