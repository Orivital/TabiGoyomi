-- プッシュ購読（端末ごと）
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own_all"
  ON push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- リマインダー全体 ON/OFF（既定 OFF）
CREATE TABLE user_reminder_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_reminder_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reminder_preferences_own_all"
  ON user_reminder_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 予定ごとのリマインダー設定（ユーザー別）
CREATE TABLE trip_event_reminder_user_prefs (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_event_id UUID NOT NULL REFERENCES trip_events (id) ON DELETE CASCADE,
  remind_start_enabled BOOLEAN NOT NULL DEFAULT true,
  remind_end_enabled BOOLEAN NOT NULL DEFAULT true,
  remind_start_minutes_before INTEGER NOT NULL DEFAULT 5
    CONSTRAINT chk_remind_start_minutes CHECK (remind_start_minutes_before >= 0 AND remind_start_minutes_before <= 24 * 60),
  remind_end_minutes_before INTEGER NOT NULL DEFAULT 5
    CONSTRAINT chk_remind_end_minutes CHECK (remind_end_minutes_before >= 0 AND remind_end_minutes_before <= 24 * 60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_event_id)
);

CREATE INDEX idx_trip_event_reminder_user_prefs_event ON trip_event_reminder_user_prefs (trip_event_id);

ALTER TABLE trip_event_reminder_user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_event_reminder_user_prefs_own_all"
  ON trip_event_reminder_user_prefs
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM trip_events te
      JOIN trip_days td ON te.trip_day_id = td.id
      JOIN trips t ON td.trip_id = t.id
      WHERE te.id = trip_event_reminder_user_prefs.trip_event_id
        AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM trip_events te
      JOIN trip_days td ON te.trip_day_id = td.id
      JOIN trips t ON td.trip_id = t.id
      WHERE te.id = trip_event_reminder_user_prefs.trip_event_id
        AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
    )
  );

-- 送信済み（二重送信防止）※クライアントからは参照しない
CREATE TABLE reminder_notifications_sent (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_event_id UUID NOT NULL REFERENCES trip_events (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('start', 'end')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_event_id, kind)
);

CREATE INDEX idx_reminder_notifications_sent_user ON reminder_notifications_sent (user_id);

ALTER TABLE reminder_notifications_sent ENABLE ROW LEVEL SECURITY;
-- authenticated にはポリシーなし（service_role のみ利用）

-- Edge Function 用: 送信対象候補（1 ユーザー・1 予定・1 kind につき 1 行）
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
  unioned AS (
    SELECT * FROM start_candidates WHERE enabled
    UNION ALL
    SELECT * FROM end_candidates WHERE enabled
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
      ELSE '旅暦｜まもなく終了'::text
    END AS notification_title,
    CASE
      WHEN due.kind = 'start' THEN
        format('【%s】%s — あと%s分で開始予定です', due.trip_title, due.event_title, due.mins)
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
