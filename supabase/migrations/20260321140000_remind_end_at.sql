-- 終了時刻ぴったりのアラート（終了○分前とは別に選択可能）
ALTER TABLE trip_event_reminder_user_prefs
  ADD COLUMN IF NOT EXISTS remind_end_at_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE reminder_notifications_sent
  DROP CONSTRAINT IF EXISTS reminder_notifications_sent_kind_check;

ALTER TABLE reminder_notifications_sent
  ADD CONSTRAINT reminder_notifications_sent_kind_check
  CHECK (kind IN ('start', 'end', 'end_at'));

CREATE OR REPLACE FUNCTION public.reminder_dispatch_candidates(p_now timestamptz)
RETURNS TABLE (
  user_id uuid,
  trip_event_id uuid,
  trip_id uuid,
  day_date date,
  kind text,
  notification_title text,
  notification_body text,
  url_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jst_date AS (
    SELECT (p_now AT TIME ZONE 'Asia/Tokyo')::date AS d
  ),
  events_base AS (
    SELECT
      te.id AS trip_event_id,
      t.id AS trip_id,
      t.title AS trip_title,
      te.title AS event_title,
      td.day_date,
      te.start_time,
      te.end_time
    FROM trip_events te
    INNER JOIN trip_days td ON te.trip_day_id = td.id
    INNER JOIN trips t ON td.trip_id = t.id
    CROSS JOIN jst_date j
    WHERE td.day_date BETWEEN j.d - 1 AND j.d + 3
  ),
  users_with_reminders AS (
    SELECT DISTINCT ps.user_id
    FROM push_subscriptions ps
    INNER JOIN user_reminder_preferences urp ON urp.user_id = ps.user_id AND urp.reminders_enabled = true
  ),
  start_candidates AS (
    SELECT
      u.user_id,
      e.trip_event_id,
      e.trip_id,
      e.day_date,
      'start'::text AS kind,
      ((e.day_date + e.start_time) AT TIME ZONE 'Asia/Tokyo')
        - make_interval(mins => COALESCE(p.remind_start_minutes_before, 5)) AS fire_at,
      COALESCE(p.remind_start_enabled, true) AS enabled,
      COALESCE(p.remind_start_minutes_before, 5)::integer AS mins,
      e.trip_title,
      e.event_title
    FROM users_with_reminders u
    CROSS JOIN events_base e
    LEFT JOIN trip_event_reminder_user_prefs p
      ON p.user_id = u.user_id AND p.trip_event_id = e.trip_event_id
    WHERE e.start_time IS NOT NULL
      AND COALESCE(p.remind_start_enabled, true) = true
  ),
  end_candidates AS (
    SELECT
      u.user_id,
      e.trip_event_id,
      e.trip_id,
      e.day_date,
      'end'::text AS kind,
      ((e.day_date + e.end_time) AT TIME ZONE 'Asia/Tokyo')
        - make_interval(mins => COALESCE(p.remind_end_minutes_before, 5)) AS fire_at,
      COALESCE(p.remind_end_enabled, true) AS enabled,
      COALESCE(p.remind_end_minutes_before, 5)::integer AS mins,
      e.trip_title,
      e.event_title
    FROM users_with_reminders u
    CROSS JOIN events_base e
    LEFT JOIN trip_event_reminder_user_prefs p
      ON p.user_id = u.user_id AND p.trip_event_id = e.trip_event_id
    WHERE e.end_time IS NOT NULL
      AND COALESCE(p.remind_end_enabled, true) = true
  ),
  end_at_candidates AS (
    SELECT
      u.user_id,
      e.trip_event_id,
      e.trip_id,
      e.day_date,
      'end_at'::text AS kind,
      ((e.day_date + e.end_time) AT TIME ZONE 'Asia/Tokyo') AS fire_at,
      COALESCE(p.remind_end_at_enabled, false) AS enabled,
      0::integer AS mins,
      e.trip_title,
      e.event_title
    FROM users_with_reminders u
    CROSS JOIN events_base e
    LEFT JOIN trip_event_reminder_user_prefs p
      ON p.user_id = u.user_id AND p.trip_event_id = e.trip_event_id
    WHERE e.end_time IS NOT NULL
      AND COALESCE(p.remind_end_at_enabled, false) = true
  ),
  unioned AS (
    SELECT * FROM start_candidates WHERE enabled
    UNION ALL
    SELECT * FROM end_candidates WHERE enabled
    UNION ALL
    SELECT * FROM end_at_candidates WHERE enabled
  ),
  due AS (
    SELECT
      unioned.user_id,
      unioned.trip_event_id,
      unioned.trip_id,
      unioned.day_date,
      unioned.kind,
      unioned.mins,
      unioned.trip_title,
      unioned.event_title
    FROM unioned
    WHERE unioned.fire_at >= p_now
      AND unioned.fire_at < p_now + interval '7 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM reminder_notifications_sent r
        WHERE r.user_id = unioned.user_id
          AND r.trip_event_id = unioned.trip_event_id
          AND r.kind = unioned.kind
      )
  )
  SELECT
    due.user_id,
    due.trip_event_id,
    due.trip_id,
    due.day_date,
    due.kind,
    CASE
      WHEN due.kind = 'start' THEN '旅暦｜まもなく開始'::text
      WHEN due.kind = 'end_at' THEN '旅暦｜終了時刻'::text
      ELSE '旅暦｜まもなく終了'::text
    END AS notification_title,
    CASE
      WHEN due.kind = 'start' THEN
        format('【%s】%s — あと%s分で開始予定です', due.trip_title, due.event_title, due.mins)
      WHEN due.kind = 'end_at' THEN
        format('【%s】%s — 終了時刻です', due.trip_title, due.event_title)
      ELSE
        format('【%s】%s — あと%s分で終了予定です', due.trip_title, due.event_title, due.mins)
    END AS notification_body,
    format(
      '/trips/%s?day=%s&event=%s',
      due.trip_id::text,
      due.day_date::text,
      due.trip_event_id::text
    ) AS url_path
  FROM due;
$$;

REVOKE ALL ON FUNCTION public.reminder_dispatch_candidates(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reminder_dispatch_candidates(timestamptz) TO service_role;
