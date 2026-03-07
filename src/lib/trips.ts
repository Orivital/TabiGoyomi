import { supabase } from './supabase'
import type { Trip, TripDay, TripEvent, TripChecklistItem } from '../types/database'

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
      'title' | 'location' | 'start_time' | 'end_time' | 'description' | 'sort_order' | 'is_reserved' | 'is_settled' | 'is_reservation_not_needed' | 'cost' | 'phone' | 'address' | 'opening_hours' | 'website_url' | 'google_maps_url' | 'receipt_image_url' | 'travel_mode'
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
  // ストレージから予約明細画像をクリーンアップ
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
