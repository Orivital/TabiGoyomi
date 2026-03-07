-- 移動時間のキャッシュをDB保存（Distance Matrix APIの呼び出し削減）
ALTER TABLE trip_events
  ADD COLUMN travel_duration_minutes INT DEFAULT NULL;
