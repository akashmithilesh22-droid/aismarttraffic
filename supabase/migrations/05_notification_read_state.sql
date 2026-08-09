-- Migration 05: Notification Read State, Event/Prediction Linkage, and Duplicate Prevention

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prediction_id UUID REFERENCES public.predictions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_prediction_type_target
  ON public.notifications (prediction_id, type, recipient_user, recipient_role, recipient_station);

CREATE OR REPLACE FUNCTION public.trigger_ai_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_level = 'High' OR NEW.risk_level = 'Critical' THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      recipient_user,
      recipient_station,
      recipient_role,
      event_id,
      prediction_id,
      created_by
    )
    VALUES (
      'AI ' || NEW.risk_level || ' Risk Alert',
      'Prediction generated for event ID ' || NEW.event_id || ' with ' || NEW.risk_level || ' risk.',
      CASE WHEN NEW.risk_level = 'Critical' THEN 'Critical Congestion' ELSE 'High Risk Alert' END,
      NEW.risk_level,
      NULL,
      NULL,
      NULL,
      NEW.event_id,
      NEW.id,
      auth.uid()
    )
    ON CONFLICT (prediction_id, type, recipient_user, recipient_role, recipient_station)
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
