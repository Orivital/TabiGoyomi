import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchTrip,
  fetchTripDays,
  fetchTripEvents,
} from '../lib/trips'
import type { Trip, TripDay, TripEvent } from '../types/database'
import { consumeSelfUpdate } from '../lib/realtimeSkipList'

export type TripDayWithEvents = TripDay & { events: TripEvent[] }

export function useTripDetail(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripDays, setTripDays] = useState<TripDayWithEvents[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!tripId) {
      setTrip(null)
      setTripDays([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const [tripData, daysData] = await Promise.all([
        fetchTrip(tripId),
        fetchTripDays(tripId),
      ])
      setTrip(tripData)

      const daysWithEvents: TripDayWithEvents[] = await Promise.all(
        daysData.map(async (day) => {
          const events = await fetchTripEvents(day.id)
          return { ...day, events }
        })
      )
      setTripDays(daysWithEvents)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load trip'))
    } finally {
      setIsLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!tripId) return

    const channel = supabase
      .channel(`trip-detail-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        load
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_days', filter: `trip_id=eq.${tripId}` },
        load
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_events' },
        (payload) => {
          // Skip reload for self-initiated travel_mode updates
          const id = (payload.new as { id?: string })?.id
          if (id && payload.eventType === 'UPDATE' && consumeSelfUpdate(id)) return
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, load])

  return { trip, tripDays, isLoading, error, refetch: load }
}
