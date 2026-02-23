-- trip-thumbnails 公開バケット作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-thumbnails',
  'trip-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS ポリシー: allowed_users のみアップロード/更新/削除可
CREATE POLICY "allowed_users_can_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trip-thumbnails'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

CREATE POLICY "allowed_users_can_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'trip-thumbnails'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

CREATE POLICY "allowed_users_can_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'trip-thumbnails'
    AND (auth.jwt()->>'email')::text IN (SELECT email FROM allowed_users)
  );

-- 公開バケットなので SELECT は全員可
CREATE POLICY "public_can_read_thumbnails"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'trip-thumbnails');
