-- event_memories の sort_order 採番競合を防止

-- 既存データを trip_id ごとに安定した連番へ補正
WITH ranked_memories AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) - 1 AS next_sort_order
  FROM event_memories
)
UPDATE event_memories AS memories
SET sort_order = ranked_memories.next_sort_order
FROM ranked_memories
WHERE memories.id = ranked_memories.id;

-- 重複防止: trip ごとに sort_order は一意
ALTER TABLE event_memories
  ADD CONSTRAINT event_memories_trip_id_sort_order_key UNIQUE (trip_id, sort_order);

-- 暗黙の 0 を防ぐ
ALTER TABLE event_memories
  ALTER COLUMN sort_order DROP DEFAULT;

-- trip 行ロック + MAX(sort_order)+1 で原子的に挿入
CREATE OR REPLACE FUNCTION public.insert_event_memory(
  p_trip_id UUID,
  p_file_url TEXT,
  p_file_type TEXT,
  p_updated_at TIMESTAMPTZ DEFAULT now()
)
RETURNS event_memories
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  inserted_memory event_memories;
BEGIN
  PERFORM 1
  FROM trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id
      USING ERRCODE = '23503';
  END IF;

  INSERT INTO event_memories (
    trip_id,
    file_url,
    file_type,
    sort_order,
    updated_at
  )
  SELECT
    p_trip_id,
    p_file_url,
    p_file_type,
    COALESCE(MAX(sort_order), -1) + 1,
    COALESCE(p_updated_at, now())
  FROM event_memories
  WHERE trip_id = p_trip_id
  RETURNING * INTO inserted_memory;

  RETURN inserted_memory;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_event_memory(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
