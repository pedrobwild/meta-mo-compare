-- Create a trigger function that sends email via pg_net when alert_events are inserted
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_alert_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rule RECORD;
  _channels jsonb;
  _has_email boolean;
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only trigger on open events
  IF NEW.status != 'open' THEN
    RETURN NEW;
  END IF;

  -- Get the rule to check if email notification is enabled
  SELECT name, metric, operator, threshold, severity, notification_channels_json
  INTO _rule
  FROM public.alert_rules
  WHERE id = NEW.rule_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _channels := COALESCE(_rule.notification_channels_json, '[]'::jsonb);
  _has_email := _channels ? 'email';

  IF NOT _has_email THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from vault or use hardcoded project URL
  _supabase_url := 'https://uziafykdgmibcpttagmr.supabase.co';
  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- If anon key not available from settings, skip (edge function will use service role internally)
  -- Use pg_net to call the edge function
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-alert-email',
    body := jsonb_build_object(
      'rule_name', _rule.name,
      'metric_label', _rule.metric,
      'current_value', COALESCE((NEW.context_json->>'current_value')::numeric, 0),
      'threshold', COALESCE((NEW.context_json->>'threshold')::numeric, _rule.threshold),
      'operator', _rule.operator,
      'severity', COALESCE(NEW.context_json->>'severity', _rule.severity),
      'entity_name', COALESCE(NEW.context_json->>'entity', ''),
      'app_url', 'https://meta-mo-compare.lovable.app'
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alert_event_email
AFTER INSERT ON public.alert_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_alert_email();