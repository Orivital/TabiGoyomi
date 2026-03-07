-- イベント間の移動手段をDB保存（デバイス間同期のため）
ALTER TABLE trip_events
  ADD COLUMN travel_mode TEXT DEFAULT NULL;
