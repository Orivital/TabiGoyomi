-- 許可ユーザー（3人のGoogleメールを登録）
CREATE TABLE allowed_users (
  email TEXT PRIMARY KEY
);

-- RLS を有効化
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- allowed_users はサービスロールのみが編集可能（ダッシュボードまたは seed で登録）
-- 認証済みユーザーは自分のメールが含まれるか確認するために SELECT 可能
CREATE POLICY "authenticated_can_check_allowed"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (true);
