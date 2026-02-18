-- 予約済み・精算済みフィールドを追加
ALTER TABLE trip_events
  ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT false;
