ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS availability_date date,
  ADD COLUMN IF NOT EXISTS availability_start_time time,
  ADD COLUMN IF NOT EXISTS availability_end_time time,
  ADD COLUMN IF NOT EXISTS tutoring_method text,
  ADD COLUMN IF NOT EXISTS meeting_details text;
