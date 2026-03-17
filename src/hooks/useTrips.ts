import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTrips, fetchTripTotalCosts } from '../lib/trips'
import type { Trip } from '../types/database'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripCosts, setTripCosts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadTrips = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [data, costs] = await Promise.all([
        fetchTrips(),
        fetchTripTotalCosts(),
      ])
      setTrips(data)
      setTripCosts(costs)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load trips'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTrips()
  }, [])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    const channelName = `trips-changes-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timer = window.setTimeout(() => {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trips' },
          () => {
            loadTrips()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trip_events' },
          () => {
            loadTrips()
          }
        )
        .subscribe((status, err) => {
          console.log('[useTrips] Realtime subscribe status:', status, err ?? '')
        })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  return { trips, tripCosts, isLoading, error, refetch: loadTrips }
}
