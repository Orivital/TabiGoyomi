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
    const channel = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          loadTrips()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { trips, tripCosts, isLoading, error, refetch: loadTrips }
}
