-- 旅暦: Supabase マイグレーション
-- Supabase Dashboard の SQL Editor でこのファイルの内容を実行してください
-- ※初回のみ実行。既にテーブルがある場合は ALTER PUBLICATION でエラーが出る場合があります（無視してOK）

-- 1. 許可ユーザーテーブル
CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY
);

ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_check_allowed" ON allowed_users;
CREATE POLICY "authenticated_can_check_allowed"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. 旅程テーブル
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE trips;

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_listed_users_all" ON trips;
CREATE POLICY "allow_listed_users_all"
  ON trips
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

-- 3. 旅程の日テーブル
CREATE TABLE IF NOT EXISTS trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, day_date)
);

ALTER PUBLICATION supabase_realtime ADD TABLE trip_days;

ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_listed_users_all" ON trip_days;
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

-- 4. 各日の予定テーブル
CREATE TABLE IF NOT EXISTS trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  start_time TIME,
  end_time TIME,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_reserved BOOLEAN NOT NULL DEFAULT false,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  is_reservation_not_needed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE trip_events;

ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_listed_users_all" ON trip_events;
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
