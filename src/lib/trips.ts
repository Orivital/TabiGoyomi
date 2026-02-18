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
  const { error } = await supabase.from('trips').delete().eq('id', id)
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
      'title' | 'location' | 'start_time' | 'end_time' | 'description' | 'sort_order' | 'is_reserved' | 'is_settled' | 'is_reservation_not_needed'
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
