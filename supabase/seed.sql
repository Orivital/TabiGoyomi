-- 許可ユーザーを登録（デプロイ時に実際のメールアドレスに置き換えてください）
INSERT INTO allowed_users (email) VALUES
  ('your-email@example.com')
ON CONFLICT (email) DO NOTHING;
