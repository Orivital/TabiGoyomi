-- 旅程の日テーブル
CREATE TABLE trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, day_date)
);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE trip_days;

-- RLS を有効化
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_listed_users_all"
  ON trip_days
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );
