-- Migration 06: Traffic Dataset Table for Supabase Source of Truth

-- 1. Traffic dataset table
CREATE TABLE IF NOT EXISTS public.traffic_records (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  endlatitude NUMERIC(10,7),
  endlongitude NUMERIC(10,7),
  address TEXT,
  end_address TEXT,
  event_cause TEXT,
  requires_road_closure TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  status TEXT,
  authenticated TEXT,
  modified_datetime TIMESTAMPTZ,
  map_file TEXT,
  direction TEXT,
  description TEXT,
  veh_type TEXT,
  veh_no TEXT,
  corridor TEXT,
  priority TEXT,
  cargo_material TEXT,
  reason_breakdown TEXT,
  age_of_truck TEXT,
  created_date TEXT,
  route_path TEXT,
  client_id TEXT,
  created_by_id TEXT,
  last_modified_by_id TEXT,
  assigned_to_police_id TEXT,
  citizen_accident_id TEXT,
  comment TEXT,
  police_station TEXT,
  meta_data TEXT,
  kgid TEXT,
  resolved_at_address TEXT,
  resolved_at_latitude NUMERIC(10,7),
  resolved_at_longitude NUMERIC(10,7),
  closed_by_id TEXT,
  closed_datetime TIMESTAMPTZ,
  resolved_by_id TEXT,
  resolved_datetime TIMESTAMPTZ,
  gba_identifier TEXT,
  zone TEXT,
  junction TEXT
);

ALTER TABLE public.traffic_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public traffic dataset can be selected"
  ON public.traffic_records FOR SELECT
  USING (true);

CREATE POLICY "Only service roles can insert traffic dataset rows"
  ON public.traffic_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only service roles can update traffic dataset rows"
  ON public.traffic_records FOR UPDATE
  USING (false);

CREATE POLICY "Only service roles can delete traffic dataset rows"
  ON public.traffic_records FOR DELETE
  USING (false);

-- Optional index on corridor and zone for filtering
CREATE INDEX IF NOT EXISTS idx_traffic_records_corridor ON public.traffic_records(corridor);
CREATE INDEX IF NOT EXISTS idx_traffic_records_zone ON public.traffic_records(zone);
CREATE INDEX IF NOT EXISTS idx_traffic_records_junction ON public.traffic_records(junction);
CREATE INDEX IF NOT EXISTS idx_traffic_records_start_datetime ON public.traffic_records(start_datetime DESC);
