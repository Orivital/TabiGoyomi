-- 各日の予定テーブル
CREATE TABLE trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  start_time TIME,
  end_time TIME,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE trip_events;

-- RLS を有効化
ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_listed_users_all"
  ON trip_events
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );
