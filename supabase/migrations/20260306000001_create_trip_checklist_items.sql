-- チェックリストアイテムテーブル
CREATE TABLE trip_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_trip_checklist_items_trip_id ON trip_checklist_items(trip_id);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE trip_checklist_items;

-- RLS を有効化
ALTER TABLE trip_checklist_items ENABLE ROW LEVEL SECURITY;

-- 許可ユーザーのみアクセス可能
CREATE POLICY "allow_listed_users_all"
  ON trip_checklist_items
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );
