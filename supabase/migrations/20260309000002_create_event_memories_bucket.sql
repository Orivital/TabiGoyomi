-- event-memories 公開バケット作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-memories',
  'event-memories',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
);

-- RLS ポリシー: allowed_users のみアップロード/更新/削除可
CREATE POLICY "allowed_users_can_upload_memories"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-memories'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

CREATE POLICY "allowed_users_can_update_memories"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-memories'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

CREATE POLICY "allowed_users_can_delete_memories"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-memories'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

-- 公開バケットなので SELECT は全員可
CREATE POLICY "public_can_read_memories"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'event-memories');
