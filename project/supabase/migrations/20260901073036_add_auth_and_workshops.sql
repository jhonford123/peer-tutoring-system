/*
# Add Auth Support, Profiles, and Tutor Workshops

## Overview
This migration transitions the Peer Tutoring System from a single-tenant (no auth) app
to a multi-user app with authentication. It adds user profiles, tutor workshops, and
workshop enrollments. All existing tables have their RLS policies updated from
`TO anon, authenticated` to `TO authenticated` so that only logged-in users can access data.

## New Tables

### 1. profiles
- `id` (uuid, PK, references auth.users) — one row per authenticated user
- `full_name` (text, not null) — display name
- `role` (text, default 'staff') — 'admin' | 'tutor' | 'staff'
- `phone` (text)
- `created_at` (timestamptz)

### 2. workshops
- `id` (uuid, primary key)
- `title` (text, not null)
- `description` (text)
- `tutor_id` (uuid, FK → tutors) — tutor leading the workshop
- `workshop_date` (date, not null)
- `start_time` (time, not null)
- `end_time` (time, not null)
- `location` (text)
- `capacity` (integer, default 30) — max attendees
- `status` (text, default 'scheduled') — 'scheduled' | 'completed' | 'cancelled'
- `created_at` (timestamptz)

### 3. workshop_enrollments
- `id` (uuid, primary key)
- `workshop_id` (uuid, FK → workshops ON DELETE CASCADE)
- `student_name` (text, not null)
- `student_email` (text)
- `status` (text, default 'enrolled') — 'enrolled' | 'attended' | 'cancelled'
- `created_at` (timestamptz)
- Unique constraint on (workshop_id, student_email)

## Modified Tables (RLS Policy Updates)
All existing tables (subjects, tutors, tutor_subjects, sessions, inventory_items,
inventory_transactions, bills, bill_items) have their policies dropped and recreated
as `TO authenticated` only — no more anon access.

## Security
- RLS enabled on all new tables.
- profiles: users can read all profiles, update only their own.
- workshops: all authenticated users can CRUD (shared institutional data).
- workshop_enrollments: all authenticated users can CRUD (shared institutional data).
- All existing tables: authenticated-only CRUD (no anon access).
*/

-- ============ NEW TABLE: profiles ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  phone text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ NEW TABLE: workshops ============
CREATE TABLE IF NOT EXISTS workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tutor_id uuid REFERENCES tutors(id) ON DELETE SET NULL,
  workshop_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  capacity integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_workshops" ON workshops;
CREATE POLICY "select_workshops" ON workshops FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_workshops" ON workshops;
CREATE POLICY "insert_workshops" ON workshops FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_workshops" ON workshops;
CREATE POLICY "update_workshops" ON workshops FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_workshops" ON workshops;
CREATE POLICY "delete_workshops" ON workshops FOR DELETE
  TO authenticated USING (true);

-- ============ NEW TABLE: workshop_enrollments ============
CREATE TABLE IF NOT EXISTS workshop_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_email text,
  status text NOT NULL DEFAULT 'enrolled',
  created_at timestamptz DEFAULT now(),
  UNIQUE (workshop_id, student_email)
);
ALTER TABLE workshop_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_enrollments" ON workshop_enrollments;
CREATE POLICY "select_enrollments" ON workshop_enrollments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_enrollments" ON workshop_enrollments;
CREATE POLICY "insert_enrollments" ON workshop_enrollments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_enrollments" ON workshop_enrollments;
CREATE POLICY "update_enrollments" ON workshop_enrollments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_enrollments" ON workshop_enrollments;
CREATE POLICY "delete_enrollments" ON workshop_enrollments FOR DELETE
  TO authenticated USING (true);

-- ============ UPDATE EXISTING TABLE POLICIES ============

-- subjects
DROP POLICY IF EXISTS "anon_crud_subjects" ON subjects;
DROP POLICY IF EXISTS "anon_insert_subjects" ON subjects;
DROP POLICY IF EXISTS "anon_update_subjects" ON subjects;
DROP POLICY IF EXISTS "anon_delete_subjects" ON subjects;
DROP POLICY IF EXISTS "select_subjects" ON subjects;
DROP POLICY IF EXISTS "insert_subjects" ON subjects;
DROP POLICY IF EXISTS "update_subjects" ON subjects;
DROP POLICY IF EXISTS "delete_subjects" ON subjects;
CREATE POLICY "select_subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_subjects" ON subjects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_subjects" ON subjects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_subjects" ON subjects FOR DELETE TO authenticated USING (true);

-- tutors
DROP POLICY IF EXISTS "anon_select_tutors" ON tutors;
DROP POLICY IF EXISTS "anon_insert_tutors" ON tutors;
DROP POLICY IF EXISTS "anon_update_tutors" ON tutors;
DROP POLICY IF EXISTS "anon_delete_tutors" ON tutors;
DROP POLICY IF EXISTS "select_tutors" ON tutors;
DROP POLICY IF EXISTS "insert_tutors" ON tutors;
DROP POLICY IF EXISTS "update_tutors" ON tutors;
DROP POLICY IF EXISTS "delete_tutors" ON tutors;
CREATE POLICY "select_tutors" ON tutors FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_tutors" ON tutors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_tutors" ON tutors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_tutors" ON tutors FOR DELETE TO authenticated USING (true);

-- tutor_subjects
DROP POLICY IF EXISTS "anon_select_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "anon_insert_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "anon_update_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "anon_delete_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "select_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "insert_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "update_tutor_subjects" ON tutor_subjects;
DROP POLICY IF EXISTS "delete_tutor_subjects" ON tutor_subjects;
CREATE POLICY "select_tutor_subjects" ON tutor_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_tutor_subjects" ON tutor_subjects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_tutor_subjects" ON tutor_subjects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_tutor_subjects" ON tutor_subjects FOR DELETE TO authenticated USING (true);

-- sessions
DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
DROP POLICY IF EXISTS "select_sessions" ON sessions;
DROP POLICY IF EXISTS "insert_sessions" ON sessions;
DROP POLICY IF EXISTS "update_sessions" ON sessions;
DROP POLICY IF EXISTS "delete_sessions" ON sessions;
CREATE POLICY "select_sessions" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sessions" ON sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sessions" ON sessions FOR DELETE TO authenticated USING (true);

-- inventory_items
DROP POLICY IF EXISTS "anon_select_inventory" ON inventory_items;
DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory_items;
DROP POLICY IF EXISTS "anon_update_inventory" ON inventory_items;
DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory_items;
DROP POLICY IF EXISTS "select_inventory" ON inventory_items;
DROP POLICY IF EXISTS "insert_inventory" ON inventory_items;
DROP POLICY IF EXISTS "update_inventory" ON inventory_items;
DROP POLICY IF EXISTS "delete_inventory" ON inventory_items;
CREATE POLICY "select_inventory" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_inventory" ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_inventory" ON inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_inventory" ON inventory_items FOR DELETE TO authenticated USING (true);

-- inventory_transactions
DROP POLICY IF EXISTS "anon_select_inv_trans" ON inventory_transactions;
DROP POLICY IF EXISTS "anon_insert_inv_trans" ON inventory_transactions;
DROP POLICY IF EXISTS "anon_delete_inv_trans" ON inventory_transactions;
DROP POLICY IF EXISTS "select_inv_trans" ON inventory_transactions;
DROP POLICY IF EXISTS "insert_inv_trans" ON inventory_transactions;
DROP POLICY IF EXISTS "delete_inv_trans" ON inventory_transactions;
CREATE POLICY "select_inv_trans" ON inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_inv_trans" ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_inv_trans" ON inventory_transactions FOR DELETE TO authenticated USING (true);

-- bills
DROP POLICY IF EXISTS "anon_select_bills" ON bills;
DROP POLICY IF EXISTS "anon_insert_bills" ON bills;
DROP POLICY IF EXISTS "anon_update_bills" ON bills;
DROP POLICY IF EXISTS "anon_delete_bills" ON bills;
DROP POLICY IF EXISTS "select_bills" ON bills;
DROP POLICY IF EXISTS "insert_bills" ON bills;
DROP POLICY IF EXISTS "update_bills" ON bills;
DROP POLICY IF EXISTS "delete_bills" ON bills;
CREATE POLICY "select_bills" ON bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_bills" ON bills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_bills" ON bills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_bills" ON bills FOR DELETE TO authenticated USING (true);

-- bill_items
DROP POLICY IF EXISTS "anon_select_bill_items" ON bill_items;
DROP POLICY IF EXISTS "anon_insert_bill_items" ON bill_items;
DROP POLICY IF EXISTS "anon_delete_bill_items" ON bill_items;
DROP POLICY IF EXISTS "select_bill_items" ON bill_items;
DROP POLICY IF EXISTS "insert_bill_items" ON bill_items;
DROP POLICY IF EXISTS "delete_bill_items" ON bill_items;
CREATE POLICY "select_bill_items" ON bill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_bill_items" ON bill_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_bill_items" ON bill_items FOR DELETE TO authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_workshops_tutor ON workshops(tutor_id);
CREATE INDEX IF NOT EXISTS idx_workshops_date ON workshops(workshop_date);
CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_workshop ON workshop_enrollments(workshop_id);