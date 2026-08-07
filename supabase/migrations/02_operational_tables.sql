-- Migration 02: Full Operational Tables for Events, Predictions, Resource Plans, Reports, and Audit Logs

-- 1. Traffic Events Table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  location TEXT NOT NULL,
  corridor TEXT NOT NULL,
  junction TEXT NOT NULL,
  zone TEXT NOT NULL,
  police_station TEXT NOT NULL,
  expected_attendance INT DEFAULT 0,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_time TIME NOT NULL DEFAULT CURRENT_TIME,
  duration_minutes INT NOT NULL DEFAULT 60,
  requires_closure BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all station events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Users can insert events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = created_by);

-- 2. AI Predictions Table
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  impact_score NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Moderate', 'High', 'Critical')),
  confidence NUMERIC(5,2) NOT NULL DEFAULT 85.00,
  estimated_clearance INT DEFAULT 60,
  timeline_json JSONB,
  feature_importance_json JSONB,
  similar_events_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view predictions"
  ON public.predictions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert predictions"
  ON public.predictions FOR INSERT
  WITH CHECK (true);

-- 3. Resource Deployment Plans Table
CREATE TABLE IF NOT EXISTS public.resource_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE NOT NULL,
  officers INT NOT NULL DEFAULT 0,
  marshals INT NOT NULL DEFAULT 0,
  barricades INT NOT NULL DEFAULT 0,
  diversions INT NOT NULL DEFAULT 0,
  checkpoints INT NOT NULL DEFAULT 0,
  ambulances INT NOT NULL DEFAULT 0,
  rapid_response_units INT NOT NULL DEFAULT 0,
  deployment_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.resource_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view resource plans"
  ON public.resource_plans FOR SELECT
  USING (true);

CREATE POLICY "Users can insert resource plans"
  ON public.resource_plans FOR INSERT
  WITH CHECK (true);

-- 4. PDF Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE NOT NULL,
  pdf_url TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports"
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "Users can insert reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = generated_by);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_predictions_event_id ON public.predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_resource_plans_prediction_id ON public.resource_plans(prediction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
