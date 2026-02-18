-- 予約不要フィールドを追加
ALTER TABLE trip_events
  ADD COLUMN IF NOT EXISTS is_reservation_not_needed BOOLEAN NOT NULL DEFAULT false;
