/*
# Add Account Approval System for Admin Dashboard

## Overview
This migration adds an account status column to the profiles table so that new signups
must be approved by an admin before they can access the system. The first admin account
(matibag220@gmail.com) is automatically granted admin role and approved status via a
database trigger on profile creation.

## Changes

### Modified Table: profiles
- Added `account_status` column (text, default 'pending') — values: 'pending', 'approved', 'rejected'
- Added `rejected_reason` column (text, nullable) — optional reason for rejection

### New Function: auto_approve_first_admin()
A trigger function that runs BEFORE INSERT on profiles. If the new profile's email
matches 'matibag220@gmail.com' (looked up via auth.users), it sets role='admin' and
account_status='approved' automatically.

### New Trigger: trg_auto_approve_admin
Fires BEFORE INSERT on profiles, calls auto_approve_first_admin().

## Security
- RLS policies on profiles are updated so that:
  - SELECT: all authenticated users can read profiles (needed to see who is admin)
  - INSERT: users can insert their own profile (account_status defaults to 'pending')
  - UPDATE: only admin users can update profiles (to approve/reject applications)
    Admins are identified by: EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'approved')
*/

-- Add account_status column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejected_reason text;

-- Update the existing INSERT policy to allow users to insert their own profile
-- (the default 'pending' status is set at DB level)
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Update SELECT policy (already allows all authenticated to read)
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

-- UPDATE policy: only admins can update profiles (approve/reject)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
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
  );

-- Function to auto-approve the first admin (matibag220@gmail.com)
CREATE OR REPLACE FUNCTION auto_approve_first_admin()
RETURNS trigger AS $$
DECLARE
  admin_email text;
BEGIN
  -- Look up the email of the user inserting this profile
  SELECT email INTO admin_email FROM auth.users WHERE id = NEW.id;
  
  -- If this is the designated first admin, auto-approve
  IF LOWER(admin_email) = 'matibag220@gmail.com' THEN
    NEW.role := 'admin';
    NEW.account_status := 'approved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire before insert on profiles
DROP TRIGGER IF EXISTS trg_auto_approve_admin ON profiles;
CREATE TRIGGER trg_auto_approve_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_first_admin();