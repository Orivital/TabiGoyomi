-- 予定に費用カラムを追加
ALTER TABLE trip_events ADD COLUMN IF NOT EXISTS cost INTEGER;
