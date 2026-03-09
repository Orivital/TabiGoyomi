import { supabase } from './supabase'
import type { Trip, TripDay, TripEvent, TripChecklistItem, EventMemory } from '../types/database'

export type TripDayWithEvents = TripDay & { trip_events: TripEvent[] }

export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) throw error
  return data as Trip[]
}

export async function fetchTripTotalCosts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('trip_days')
    .select('trip_id, trip_events(cost)')

  if (error) throw error

  const costMap: Record<string, number> = {}
  for (const day of data ?? []) {
    const tripId = (day as { trip_id: string }).trip_id
    const events = (day as { trip_events: { cost: number | null }[] }).trip_events ?? []
    for (const event of events) {
      if (event.cost != null) {
        costMap[tripId] = (costMap[tripId] ?? 0) + event.cost
      }
    }
  }
  return costMap
}

export async function fetchTrip(id: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Trip
}

export async function fetchTripDays(tripId: string) {
  const { data, error } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_date', { ascending: true })

  if (error) throw error
  return data as TripDay[]
}

export async function fetchTripEvents(tripDayId: string) {
  const { data, error } = await supabase
    .from('trip_events')
    .select('*')
    .eq('trip_day_id', tripDayId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as TripEvent[]
}

export async function fetchTripEvent(id: string) {
  const { data, error } = await supabase
    .from('trip_events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TripEvent
}

export async function createTrip(trip: {
  title: string
  start_date: string
  end_date: string
}) {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      ...trip,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  // 日付範囲で trip_days を自動作成
  const start = new Date(trip.start_date)
  const end = new Date(trip.end_date)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayDate = d.toISOString().slice(0, 10)
    await supabase.from('trip_days').insert({
      trip_id: (data as Trip).id,
      day_date: dayDate,
      updated_at: new Date().toISOString(),
    })
  }

  return data as Trip
}

export async function updateTrip(
  id: string,
  updates: Partial<Pick<Trip, 'title' | 'start_date' | 'end_date'>>
) {
  const { data, error } = await supabase
    .from('trips')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Trip
}

export async function deleteTrip(id: string) {
  // ストレージからサムネイルをクリーンアップ
  await removeTripThumbnailFile(id)
  await removeTripMemoryFiles(id)
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}

const THUMBNAIL_BUCKET = 'trip-thumbnails'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadTripThumbnail(tripId: string, file: File) {
  // バリデーション
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('JPEG、PNG、WebP のみアップロードできます')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('ファイルサイズは5MB以下にしてください')
  }

  // 既存ファイルを削除
  await removeTripThumbnailFile(tripId)

  const ext = EXTENSION_MAP[file.type] || 'jpg'
  const filePath = `${tripId}/thumbnail.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(filePath, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage
    .from(THUMBNAIL_BUCKET)
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('trips')
    .update({
      thumbnail_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
  if (updateError) throw updateError

  return urlData.publicUrl
}

export async function deleteTripThumbnail(tripId: string) {
  await removeTripThumbnailFile(tripId)

  const { error } = await supabase
    .from('trips')
    .update({
      thumbnail_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
  if (error) throw error
}

async function removeTripThumbnailFile(tripId: string) {
  const extensions = ['jpg', 'png', 'webp']
  const paths = extensions.map((ext) => `${tripId}/thumbnail.${ext}`)
  // エラーは無視（ファイルが存在しない場合もある）
  await supabase.storage.from(THUMBNAIL_BUCKET).remove(paths)
}

export async function fetchTripDaysWithEventsOutsideRange(
  tripId: string,
  newStart: string,
  newEnd: string
): Promise<TripDayWithEvents[]> {
  const { data, error } = await supabase
    .from('trip_days')
    .select('*, trip_events(*)')
    .eq('trip_id', tripId)
    .or(`day_date.lt.${newStart},day_date.gt.${newEnd}`)
    .order('day_date', { ascending: true })

  if (error) throw error

  // イベントを持つ日だけ返す
  return (data as TripDayWithEvents[]).filter(
    (day) => day.trip_events.length > 0
  )
}

export async function moveTripDayEventsToDate(
  sourceDayId: string,
  tripId: string,
  targetDate: string
): Promise<void> {
  // 移動先の trip_day を取得（なければ作成）
  let { data: targetDay } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .eq('day_date', targetDate)
    .maybeSingle()

  if (!targetDay) {
    const { data: newDay, error: createError } = await supabase
      .from('trip_days')
      .insert({
        trip_id: tripId,
        day_date: targetDate,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (createError) throw createError
    targetDay = newDay
  }

  // ソース日のイベントを移動先に付け替え
  const { error } = await supabase
    .from('trip_events')
    .update({
      trip_day_id: (targetDay as TripDay).id,
      updated_at: new Date().toISOString(),
    })
    .eq('trip_day_id', sourceDayId)

  if (error) throw error
}

export async function deleteOutOfRangeTripDays(
  tripId: string,
  newStart: string,
  newEnd: string
): Promise<void> {
  const { error } = await supabase
    .from('trip_days')
    .delete()
    .eq('trip_id', tripId)
    .or(`day_date.lt.${newStart},day_date.gt.${newEnd}`)

  if (error) throw error
}

export async function createTripDay(tripDay: {
  trip_id: string
  day_date: string
  memo?: string
}) {
  const { data, error } = await supabase
    .from('trip_days')
    .insert({
      ...tripDay,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as TripDay
}

export async function updateTripDay(
  id: string,
  updates: Partial<Pick<TripDay, 'day_date' | 'memo'>>
) {
  const { data, error } = await supabase
    .from('trip_days')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TripDay
}

export async function deleteTripDay(id: string) {
  const { error } = await supabase.from('trip_days').delete().eq('id', id)
  if (error) throw error
}

export async function createTripEvent(event: {
  trip_day_id: string
  title: string
  location?: string
  start_time?: string
  end_time?: string
  description?: string
  sort_order?: number
  is_reserved?: boolean
  is_settled?: boolean
  is_reservation_not_needed?: boolean
  cost?: number | null
  phone?: string
  address?: string
  opening_hours?: string
  website_url?: string
  google_maps_url?: string
}) {
  const { data, error } = await supabase
    .from('trip_events')
    .insert({
      ...event,
      sort_order: event.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as TripEvent
}

export async function updateTripEvent(
  id: string,
  updates: Partial<
    Pick<
      TripEvent,
      'title' | 'location' | 'start_time' | 'end_time' | 'description' | 'sort_order' | 'is_reserved' | 'is_settled' | 'is_reservation_not_needed' | 'cost' | 'phone' | 'address' | 'opening_hours' | 'website_url' | 'google_maps_url' | 'receipt_image_url' | 'travel_mode' | 'travel_duration_minutes'
    >
  >
) {
  const { data, error } = await supabase
    .from('trip_events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TripEvent
}

export async function deleteTripEvent(id: string) {
  // ストレージからメディアファイルをクリーンアップ
  await removeAllEventMemoryFiles(id)
  await removeReceiptImageFile(id)
  const { error } = await supabase.from('trip_events').delete().eq('id', id)
  if (error) throw error
}

const RECEIPT_BUCKET = 'receipt-images'
const RECEIPT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadReceiptImage(eventId: string, file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('JPEG、PNG、WebP のみアップロードできます')
  }
  if (file.size > RECEIPT_MAX_FILE_SIZE) {
    throw new Error('ファイルサイズは10MB以下にしてください')
  }

  // 既存ファイルを削除
  await removeReceiptImageFile(eventId)

  const ext = EXTENSION_MAP[file.type] || 'jpg'
  const filePath = `${eventId}/receipt.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(filePath, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage
    .from(RECEIPT_BUCKET)
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('trip_events')
    .update({
      receipt_image_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
  if (updateError) throw updateError

  return urlData.publicUrl
}

export async function deleteReceiptImage(eventId: string) {
  await removeReceiptImageFile(eventId)

  const { error } = await supabase
    .from('trip_events')
    .update({
      receipt_image_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
  if (error) throw error
}

async function removeReceiptImageFile(eventId: string) {
  const extensions = ['jpg', 'png', 'webp']
  const paths = extensions.map((ext) => `${eventId}/receipt.${ext}`)
  await supabase.storage.from(RECEIPT_BUCKET).remove(paths)
}

// チェックリスト

export async function fetchChecklistItems(tripId: string) {
  const { data, error } = await supabase
    .from('trip_checklist_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as TripChecklistItem[]
}

export async function createChecklistItem(item: {
  trip_id: string
  title: string
  sort_order?: number
}) {
  const { data, error } = await supabase
    .from('trip_checklist_items')
    .insert({
      ...item,
      sort_order: item.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as TripChecklistItem
}

export async function updateChecklistItem(
  id: string,
  updates: Partial<Pick<TripChecklistItem, 'title' | 'is_checked' | 'sort_order'>>
) {
  const { data, error } = await supabase
    .from('trip_checklist_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TripChecklistItem
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase
    .from('trip_checklist_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// イベント思い出

const MEMORIES_BUCKET = 'event-memories'
const MEMORIES_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MEMORIES_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MEMORIES_ALLOWED_VIDEO_TYPES = ['video/mp4']

const MEMORIES_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
}

export async function fetchTripMemories(tripId: string): Promise<EventMemory[]> {
  const { data, error } = await supabase
    .from('event_memories')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return sortEventMemories(data as EventMemory[])
}

export async function uploadEventMemory(tripId: string, file: File): Promise<EventMemory> {
  const allAllowedTypes = [...MEMORIES_ALLOWED_IMAGE_TYPES, ...MEMORIES_ALLOWED_VIDEO_TYPES]
  if (!allAllowedTypes.includes(file.type)) {
    throw new Error('JPEG、PNG、WebP、MP4 のみアップロードできます')
  }
  if (file.size > MEMORIES_MAX_FILE_SIZE) {
    throw new Error('ファイルサイズは10MB以下にしてください')
  }

  const ext = MEMORIES_EXTENSION_MAP[file.type] || 'bin'
  const fileId = crypto.randomUUID()
  const filePath = `${tripId}/${fileId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(MEMORIES_BUCKET)
    .upload(filePath, file)
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage
    .from(MEMORIES_BUCKET)
    .getPublicUrl(filePath)

  try {
    const fileType = MEMORIES_ALLOWED_VIDEO_TYPES.includes(file.type) ? 'video' : 'image'
    const { data: lastMemory, error: sortOrderError } = await supabase
      .from('event_memories')
      .select('sort_order')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sortOrderError) throw sortOrderError
    const nextSortOrder = ((lastMemory as Pick<EventMemory, 'sort_order'> | null)?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('event_memories')
      .insert({
        trip_id: tripId,
        file_url: urlData.publicUrl,
        file_type: fileType,
        sort_order: nextSortOrder,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data as EventMemory
  } catch (error) {
    await removeMemoryObject(filePath)
    throw error
  }
}

export async function deleteEventMemory(memoryId: string): Promise<void> {
  // レコードを取得してファイルパスを特定
  const { data: memory, error: fetchError } = await supabase
    .from('event_memories')
    .select('*')
    .eq('id', memoryId)
    .single()
  if (fetchError) throw fetchError

  const m = memory as EventMemory
  const { error } = await supabase.from('event_memories').delete().eq('id', memoryId)
  if (error) throw error

  const bucketPath = getMemoryObjectPath(m.file_url)
  if (bucketPath) {
    await removeMemoryObject(bucketPath)
  }
}

async function removeAllEventMemoryFiles(eventId: string): Promise<void> {
  const { data: memories } = await supabase
    .from('event_memories')
    .select('file_url')
    .eq('trip_id', eventId)

  if (memories && memories.length > 0) {
    const paths = (memories as Pick<EventMemory, 'file_url'>[])
      .map((m) => getMemoryObjectPath(m.file_url))
      .filter((p): p is string => !!p)

    if (paths.length > 0) {
      await supabase.storage.from(MEMORIES_BUCKET).remove(paths)
    }
  }

  // レコードは CASCADE で削除されるが、旅行削除前に呼ばれるので明示削除
  await supabase.from('event_memories').delete().eq('trip_id', eventId)
}

function sortEventMemories(memories: EventMemory[]): EventMemory[] {
  return [...memories].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })
}

async function removeTripMemoryFiles(tripId: string): Promise<void> {
  await removeAllEventMemoryFiles(tripId)
}

function getMemoryObjectPath(fileUrl: string): string | null {
  return fileUrl.split(`/${MEMORIES_BUCKET}/`).pop() ?? null
}

async function removeMemoryObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(MEMORIES_BUCKET).remove([path])
  if (error) {
    console.error('Failed to remove memory object from storage', { path, error })
  }
}
