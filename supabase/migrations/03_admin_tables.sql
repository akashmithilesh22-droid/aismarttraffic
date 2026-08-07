-- Migration 03: Administration Module — Police Stations, Login Sessions, Profile Extensions
-- Run this in the Supabase SQL Editor AFTER migrations 01 and 02.

-- ============================================================================
-- 1. Extend profiles table with soft-delete & photo fields
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Super Admin can view ALL profiles (override single-row policy)
CREATE POLICY "Super Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Super Admin can insert profiles
CREATE POLICY "Super Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Super Admin can update any profile
CREATE POLICY "Super Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Super Admin can delete profiles (soft delete preferred, but policy exists)
CREATE POLICY "Super Admin can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Index for active officer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- 2. Police Stations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.police_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_name TEXT NOT NULL,
  station_code TEXT UNIQUE,
  zone TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  jurisdiction TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  contact_number TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.police_stations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active stations
CREATE POLICY "Authenticated users can view stations"
  ON public.police_stations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only Super Admin can insert stations
CREATE POLICY "Super Admin can insert stations"
  ON public.police_stations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Only Super Admin can update stations
CREATE POLICY "Super Admin can update stations"
  ON public.police_stations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Only Super Admin can delete stations
CREATE POLICY "Super Admin can delete stations"
  ON public.police_stations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Auto-update timestamps
CREATE TRIGGER update_police_stations_modtime
  BEFORE UPDATE ON public.police_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Indexes for police stations
CREATE INDEX IF NOT EXISTS idx_stations_zone ON public.police_stations(zone);
CREATE INDEX IF NOT EXISTS idx_stations_district ON public.police_stations(district);
CREATE INDEX IF NOT EXISTS idx_stations_is_active ON public.police_stations(is_active);
CREATE INDEX IF NOT EXISTS idx_stations_code ON public.police_stations(station_code);

-- ============================================================================
-- 3. Login Sessions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.login_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  ip_address TEXT,
  device TEXT,
  browser TEXT,
  city TEXT,
  login_success BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own login sessions
CREATE POLICY "Users can view own login sessions"
  ON public.login_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Super Admin can view all login sessions
CREATE POLICY "Super Admin can view all login sessions"
  ON public.login_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Any authenticated user can insert their own login session
CREATE POLICY "Users can insert own login sessions"
  ON public.login_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Super Admin can insert login sessions (for tracking failed logins)
CREATE POLICY "Super Admin can insert login sessions"
  ON public.login_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Super Admin'
    )
  );

-- Indexes for login sessions
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON public.login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_time ON public.login_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_success ON public.login_sessions(login_success);

-- ============================================================================
-- 4. Seed default Bengaluru police stations
-- ============================================================================
INSERT INTO public.police_stations (station_name, station_code, zone, district, address, jurisdiction, latitude, longitude, contact_number, is_active)
VALUES
  ('Indiranagar Traffic PS', 'BTP-IND', 'East', 'Bengaluru City', 'Indiranagar 100 Feet Road', 'Indiranagar, HAL', 12.9716, 77.6412, '080-25201111', true),
  ('Koramangala Traffic PS', 'BTP-KOR', 'South East', 'Bengaluru City', 'Koramangala 80 Feet Road', 'Koramangala, Madiwala', 12.9352, 77.6245, '080-25202222', true),
  ('Whitefield Traffic PS', 'BTP-WHF', 'East', 'Bengaluru City', 'Whitefield Main Road', 'Whitefield, Mahadevapura', 12.9698, 77.7500, '080-25203333', true),
  ('Jayanagar Traffic PS', 'BTP-JAY', 'South', 'Bengaluru City', 'Jayanagar 4th Block', 'Jayanagar, JP Nagar', 12.9250, 77.5938, '080-25204444', true),
  ('Rajajinagar Traffic PS', 'BTP-RAJ', 'West', 'Bengaluru City', 'Rajajinagar Industrial Area', 'Rajajinagar, Malleswaram', 12.9900, 77.5550, '080-25205555', true),
  ('MG Road Traffic PS', 'BTP-MGR', 'Central', 'Bengaluru City', 'MG Road, Brigade Road Junction', 'MG Road, Brigade Road, Church Street', 12.9756, 77.6069, '080-25206666', true),
  ('Yeshwanthpur Traffic PS', 'BTP-YPR', 'North West', 'Bengaluru City', 'Yeshwanthpur Circle', 'Yeshwanthpur, Mathikere', 13.0210, 77.5440, '080-25207777', true),
  ('Electronic City Traffic PS', 'BTP-ELC', 'South East', 'Bengaluru City', 'Electronic City Phase 1', 'Electronic City, Bommasandra', 12.8399, 77.6770, '080-25208888', true),
  ('Hebbal Traffic PS', 'BTP-HBL', 'North', 'Bengaluru City', 'Hebbal Flyover Junction', 'Hebbal, Sahakarnagar', 13.0358, 77.5970, '080-25209999', true),
  ('KR Puram Traffic PS', 'BTP-KRP', 'East', 'Bengaluru City', 'KR Puram Railway Station Road', 'KR Puram, Tin Factory', 13.0070, 77.6960, '080-25201010', true)
ON CONFLICT (station_code) DO NOTHING;

-- ============================================================================
-- 5. Update handle_new_user trigger to include new fields
-- ============================================================================
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
    is_active,
    must_change_password,
    photo_url
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Traffic Officer'),
    COALESCE(NEW.raw_user_meta_data->>'police_station', 'Bengaluru Central'),
    COALESCE(NEW.raw_user_meta_data->>'district', 'Bengaluru City'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'badge_number',
    true,
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false),
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
