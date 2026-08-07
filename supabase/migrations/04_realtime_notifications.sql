-- Migration 04: Real-Time Operations & Notification Center
-- Run this in the Supabase SQL Editor AFTER migrations 01, 02, and 03.

-- ============================================================================
-- 1. Notifications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'High Risk Alert', 'Critical Congestion', 'Officer Assignment', 'Resource Update', 'Event Updated', 'Report Generated', 'System Announcement'
  priority TEXT NOT NULL DEFAULT 'Low', -- 'Critical', 'High', 'Medium', 'Low'
  recipient_role TEXT, -- e.g., 'Inspector'. Null means not targeted by role
  recipient_station TEXT, -- e.g., 'Indiranagar Traffic PS'. Null means not targeted by station
  recipient_user UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- specific user target
  read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications Policy: Users can view notifications if they match the user ID, role, or station.
-- Super Admins can see all.
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (
    recipient_user = auth.uid() OR
    recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
    recipient_station = (SELECT police_station FROM public.profiles WHERE id = auth.uid()) OR
    (recipient_user IS NULL AND recipient_role IS NULL AND recipient_station IS NULL) OR -- Global notifications
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Users can update their notifications (mark read)"
  ON public.notifications FOR UPDATE
  USING (
    recipient_user = auth.uid() OR
    recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
    recipient_station = (SELECT police_station FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE
  USING (
    recipient_user = auth.uid() OR
    recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
    recipient_station = (SELECT police_station FROM public.profiles WHERE id = auth.uid())
  );

-- Only Super Admins or automated triggers can insert notifications generally.
-- Or users can trigger notifications via RPCs if needed.
CREATE POLICY "Super Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin')
  );

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON public.notifications(recipient_user);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 2. Extend Events Table (Assignment & Workflow)
-- ============================================================================

-- First drop the constraint if it exists (for idempotency)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;

-- Note: In PostgreSQL, we can't easily alter an ENUM type in a transaction, and we used a check constraint or plain text for status.
-- Based on previous migrations, status is likely just TEXT or a simple check. We'll ensure it allows the new statuses.
-- Valid statuses: 'Draft', 'Pending Review', 'Approved', 'Active', 'Resolved', 'Archived' (and old ones: 'PLANNED', 'IN_PROGRESS', 'CANCELLED')

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_station TEXT;

-- ============================================================================
-- 3. Triggers for Automatic AI Notifications & Workflow
-- ============================================================================

-- Trigger: When a new prediction has High or Critical risk, notify
CREATE OR REPLACE FUNCTION public.trigger_ai_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_level = 'High' OR NEW.risk_level = 'Critical' THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      created_by
    )
    VALUES (
      'AI ' || NEW.risk_level || ' Risk Alert',
      'Prediction generated for event ID ' || NEW.event_id || ' with ' || NEW.risk_level || ' risk.',
      CASE WHEN NEW.risk_level = 'Critical' THEN 'Critical Congestion' ELSE 'High Risk Alert' END,
      NEW.risk_level,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_ai_notification_on_prediction ON public.predictions;
CREATE TRIGGER trigger_ai_notification_on_prediction
  AFTER INSERT ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_notification();

-- Trigger: When event status changes, create notification and audit log
CREATE OR REPLACE FUNCTION public.trigger_event_status_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Audit Log
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata_json)
    VALUES (
      auth.uid(),
      'Status Changed to ' || NEW.status,
      'event',
      NEW.id,
      json_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
    
    -- Notification
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      recipient_station,
      created_by
    )
    VALUES (
      'Event Status Updated: ' || NEW.title,
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      'Event Updated',
      'Medium',
      NEW.police_station,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_event_status_audit_trigger ON public.events;
CREATE TRIGGER trigger_event_status_audit_trigger
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_status_audit();

-- ============================================================================
-- 4. Enable Supabase Realtime for Target Tables
-- ============================================================================
-- First, ensure publication exists (it should by default in Supabase)
-- Then add tables to the publication.

-- Using a DO block to catch errors if tables are already in publication
DO $$
BEGIN
  -- We don't drop publication, we just alter it
  -- Enable realtime for notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Enable realtime for events
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;

  -- Enable realtime for predictions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
  END IF;

  -- Enable realtime for reports
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;

  -- Enable realtime for audit_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;
