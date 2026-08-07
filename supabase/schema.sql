-- ======================================================================
-- SmartTraffic AI — Database Schema for Supabase
-- Bengaluru Traffic Police Authentication & Profiles
-- ======================================================================

-- 1. Create Profile Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (
    role IN (
      'Super Admin',
      'Commissioner',
      'ACP',
      'Inspector',
      'Sub Inspector',
      'Traffic Officer'
    )
  ),
  police_station TEXT NOT NULL DEFAULT 'Bengaluru Central',
  district TEXT NOT NULL DEFAULT 'Bengaluru City',
  phone TEXT,
  badge_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Row Level Security Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins & Commissioners can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('Super Admin', 'Commissioner', 'ACP')
    )
  );

-- 3. Automatic Updated At Timestamp Trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- 4. Automatic Profile Creation Trigger on New User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    police_station,
    district,
    phone,
    badge_number,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Inspector'),
    COALESCE(NEW.raw_user_meta_data->>'police_station', 'Indiranagar Traffic PS'),
    COALESCE(NEW.raw_user_meta_data->>'district', 'Bengaluru City'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'badge_number',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function on auth user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ======================================================================
-- SAMPLE SEED DATA (For Testing in Supabase SQL Editor)
-- Note: Replace UUIDs with actual auth.users IDs when inserting manually
-- ======================================================================
/*
INSERT INTO public.profiles (id, full_name, email, role, police_station, district, phone, badge_number)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Inspector Ravi Kumar', 'inspector.ravi@btp.gov.in', 'Inspector', 'Indiranagar Traffic PS', 'Bengaluru East', '+91 98765 43210', 'BTP-IN-4082'),
  ('00000000-0000-0000-0000-000000000002', 'ACP Anita Sharma', 'acp.sharma@btp.gov.in', 'ACP', 'Bengaluru Central HQ', 'Bengaluru Central', '+91 98765 43211', 'BTP-ACP-1004'),
  ('00000000-0000-0000-0000-000000000003', 'Commissioner M. N. Rao', 'commissioner@btp.gov.in', 'Commissioner', 'Police Commissionerate', 'Bengaluru City', '+91 98765 43212', 'BTP-COP-0001');
*/
