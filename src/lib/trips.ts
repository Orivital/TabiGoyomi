import { supabase } from './supabase'
import type { Trip, TripDay, TripEvent } from '../types/database'

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
      'title' | 'location' | 'start_time' | 'end_time' | 'description' | 'sort_order' | 'is_reserved' | 'is_settled' | 'is_reservation_not_needed' | 'cost'
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
  const { error } = await supabase.from('trip_events').delete().eq('id', id)
  if (error) throw error
}
