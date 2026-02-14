import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTrips } from '../lib/trips'
import type { Trip } from '../types/database'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadTrips = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchTrips()
      setTrips(data)
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

  return { trips, isLoading, error, refetch: loadTrips }
}
