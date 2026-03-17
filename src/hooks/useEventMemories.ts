import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTripMemories } from '../lib/trips'
import type { EventMemory } from '../types/database'

export function useEventMemories(tripId: string | null) {
  const [memories, setMemories] = useState<EventMemory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!tripId) {
      setMemories([])
      setIsLoading(false)
      return
    }

    setMemories([])
    setIsLoading(true)
  }, [tripId])

  useEffect(() => {
    if (!tripId) return
    const currentTripId = tripId

    let ignore = false

    async function load() {
      try {
        const data = await fetchTripMemories(currentTripId)
        if (!ignore) {
          setMemories(data)
        }
      } catch (e) {
        if (!ignore) {
          console.error('Failed to load event memories:', e)
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [tripId, reloadKey])

  useEffect(() => {
    if (!tripId) return
    const currentTripId = tripId

    let channel: ReturnType<typeof supabase.channel> | null = null
    const channelName = `event-memories-${currentTripId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timer = window.setTimeout(() => {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_memories',
            filter: `trip_id=eq.${currentTripId}`,
          },
          () => {
            setReloadKey((current) => current + 1)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'event_memories',
            filter: `trip_id=eq.${currentTripId}`,
          },
          () => {
            setReloadKey((current) => current + 1)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'event_memories',
          },
          () => {
            setReloadKey((current) => current + 1)
          }
        )
        .subscribe()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [tripId])

  return { memories, setMemories, isLoading }
}
