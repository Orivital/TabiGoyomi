-- db-sync-local.sh / db-sync-staging.sh がデータ投入前に実行する。
-- テーブル一覧を変えたら src/lib/syncDbTargets.test.ts の検証も更新すること。
TRUNCATE trip_events, trip_days, trips, allowed_users, event_memories RESTART IDENTITY CASCADE;
