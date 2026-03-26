-- db-sync-local.sh / db-sync-staging.sh がデータ投入前に実行する。
-- テーブル一覧を変えたら src/lib/syncDbTargets.test.ts の検証も更新すること。
-- auth.users / auth.flow_state は認証系データ。ローカル残りと本番ダンプで
-- 主キー衝突しやすいため先に空にする。
-- RESTART IDENTITY は付けない（GoTrue が auth 配下シーケンスの所有者で postgres は
-- リセットできず「must be owner of sequence …_seq」になる）。
TRUNCATE auth.users, auth.flow_state CASCADE;
TRUNCATE reminder_notifications_sent, trip_event_reminder_user_prefs, push_subscriptions, user_reminder_preferences, trip_events, trip_days, trips, event_memories, allowed_users RESTART IDENTITY CASCADE;
