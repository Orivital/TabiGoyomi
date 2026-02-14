-- 旅程テーブル
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE trips;

-- RLS を有効化
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- 許可ユーザーのみアクセス可能
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
