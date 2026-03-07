import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { getTravelTime, getCachedTravelTime, isGoogleMapsAvailable, isValidTravelMode } from '../lib/googleMaps'
import type { TravelTime, TravelMode } from '../lib/googleMaps'
import type { TripEvent } from '../types/database'
import { updateTripEvent } from '../lib/trips'

export type TravelTimePair = {
  fromEventId: string
  toEventId: string
  travelTime: TravelTime | null
  isLoading: boolean
  mode: TravelMode
  setMode: (mode: TravelMode) => void
}

type EventPair = {
  fromEventId: string
  toEventId: string
  originAddress: string
  destinationAddress: string
}

const DEFAULT_MODE: TravelMode = 'walking'

function pairKey(fromId: string, toId: string): string {
  return `${fromId}|${toId}`
}

function resultKey(fromId: string, toId: string, mode: TravelMode): string {
  return `${fromId}|${toId}|${mode}`
}

function buildPairs(events: TripEvent[]): EventPair[] {
  const pairs: EventPair[] = []
  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i]
    const to = events[i + 1]
    if (from?.address && to?.address) {
      pairs.push({
        fromEventId: from.id,
        toEventId: to.id,
        originAddress: from.address,
        destinationAddress: to.address,
      })
    }
  }
  return pairs
}

export function useTravelTimes(events: TripEvent[]): TravelTimePair[] {
  // Build modes from DB (each "from" event stores travel_mode for the next leg)
  const modesFromDb = useMemo(() => {
    const m = new Map<string, TravelMode>()
    for (let i = 0; i < events.length - 1; i++) {
      const from = events[i]
      const to = events[i + 1]
      if (from && to && isValidTravelMode(from.travel_mode)) {
        m.set(pairKey(from.id, to.id), from.travel_mode)
      }
    }
    return m
  }, [events])

  const [localModes, setLocalModes] = useState<Map<string, TravelMode>>(new Map())
  const [fetchedResults, setFetchedResults] = useState<Map<string, TravelTime>>(new Map())
  const generationRef = useRef(0)

  // Clean up localModes entries that match DB (optimistic update confirmed)
  useEffect(() => {
    setLocalModes((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const [k, v] of prev) {
        if (modesFromDb.get(k) === v) {
          next.delete(k)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [modesFromDb])

  // Merge: local overrides take precedence (for optimistic update)
  const modes = useMemo(() => {
    const merged = new Map(modesFromDb)
    for (const [k, v] of localModes) {
      merged.set(k, v)
    }
    return merged
  }, [modesFromDb, localModes])

  const pairs = useMemo(() => {
    if (!isGoogleMapsAvailable()) return []
    return buildPairs(events)
  }, [events])

  const setModeForPair = useCallback((fromId: string, toId: string, mode: TravelMode) => {
    // Optimistic local update
    setLocalModes((prev) => {
      const next = new Map(prev)
      next.set(pairKey(fromId, toId), mode)
      return next
    })
    // Persist to DB (fire-and-forget)
    updateTripEvent(fromId, { travel_mode: mode }).catch(() => {
      // Revert on failure
      setLocalModes((prev) => {
        const next = new Map(prev)
        next.delete(pairKey(fromId, toId))
        return next
      })
    })
  }, [])

  // Fetch uncached pairs asynchronously
  useEffect(() => {
    const uncached = pairs.filter((p) => {
      const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
      return !getCachedTravelTime(p.originAddress, p.destinationAddress, mode)
    })
    if (uncached.length === 0) return

    const generation = ++generationRef.current

    Promise.allSettled(
      uncached.map((p) => {
        const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
        return getTravelTime(p.originAddress, p.destinationAddress, mode)
      })
    ).then((settled) => {
      if (generationRef.current !== generation) return

      setFetchedResults((prev) => {
        const next = new Map(prev)
        uncached.forEach((p, i) => {
          const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
          const result = settled[i]
          if (result?.status === 'fulfilled') {
            next.set(resultKey(p.fromEventId, p.toEventId, mode), result.value)
          }
        })
        return next
      })
    })
  }, [pairs, modes])

  return useMemo(() => {
    return pairs.map((p) => {
      const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
      const cached = getCachedTravelTime(p.originAddress, p.destinationAddress, mode)
      const fetched = fetchedResults.get(resultKey(p.fromEventId, p.toEventId, mode))
      const travelTime = cached ?? fetched ?? null
      return {
        fromEventId: p.fromEventId,
        toEventId: p.toEventId,
        travelTime,
        isLoading: !travelTime,
        mode,
        setMode: (m: TravelMode) => setModeForPair(p.fromEventId, p.toEventId, m),
      }
    })
  }, [pairs, fetchedResults, modes, setModeForPair])
}
