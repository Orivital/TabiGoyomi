-- イベント思い出メディアテーブル
CREATE TABLE event_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- 'image' | 'video'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_event_memories_trip_id ON event_memories(trip_id);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE event_memories;

-- RLS を有効化
ALTER TABLE event_memories ENABLE ROW LEVEL SECURITY;

-- 許可ユーザーのみアクセス可能
CREATE POLICY "allow_listed_users_all"
  ON event_memories
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );
