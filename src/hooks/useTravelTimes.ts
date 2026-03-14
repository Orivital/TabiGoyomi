import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { getTravelTime, getCachedTravelTime, isGoogleMapsAvailable, isValidTravelMode, buildTravelTimeForMode } from '../lib/googleMaps'
import type { TravelTime, TravelMode, TravelTimeRequest } from '../lib/googleMaps'
import type { TripEvent } from '../types/database'
import { updateTripEvent } from '../lib/trips'
import { markSelfUpdate, clearSelfUpdate } from '../lib/realtimeSkipList'
import { buildTransitTimeRequest } from '../lib/travelTiming'

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
  dbDurationMinutes: number | null
  fromEndTime: string | null
  toStartTime: string | null
  fromStartTime: string | null
}

const DEFAULT_MODE: TravelMode = 'walking'

function pairKey(fromId: string, toId: string): string {
  return `${fromId}|${toId}`
}

function resultKey(fromId: string, toId: string, mode: TravelMode): string {
  return `${fromId}|${toId}|${mode}`
}

function normalizeAddress(location: string | null, address: string): string {
  // 全角数字・ハイフンを半角に変換（郵便番号の除去より先に行う）
  let normalized = address
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[ー−—–]/g, '-')
    .trim()
  // 郵便番号（〒xxx-xxxx）を除去
  normalized = normalized.replace(/〒?\d{3}-?\d{4}\s*/g, '').trim()
  if (location) {
    return `${location}, ${normalized}`
  }
  return normalized
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
        originAddress: normalizeAddress(from.location, from.address),
        destinationAddress: normalizeAddress(to.location, to.address),
        dbDurationMinutes: from.travel_duration_minutes,
        fromEndTime: from.end_time,
        toStartTime: to.start_time,
        fromStartTime: from.start_time,
      })
    }
  }
  return pairs
}

export function useTravelTimes(events: TripEvent[], dayDate?: string): TravelTimePair[] {
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

  // Merge: local overrides take precedence (for optimistic update)
  // Skip local entries that already match DB (confirmed optimistic updates)
  const modes = useMemo(() => {
    const merged = new Map(modesFromDb)
    for (const [k, v] of localModes) {
      if (modesFromDb.get(k) !== v) {
        merged.set(k, v)
      }
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
    // Clear fetched result so it re-fetches with new mode
    setFetchedResults((prev) => {
      const next = new Map(prev)
      // Remove all mode variants for this pair
      for (const m of ['walking', 'transit', 'driving'] as TravelMode[]) {
        next.delete(resultKey(fromId, toId, m))
      }
      return next
    })
    // Persist to DB (fire-and-forget): update mode and clear cached duration
    markSelfUpdate(fromId)
    updateTripEvent(fromId, { travel_mode: mode, travel_duration_minutes: null }).catch(() => {
      clearSelfUpdate(fromId)
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
      // Transit always re-fetches with schedule-aware timing
      if (mode === 'transit') return true
      // Skip if we have an in-memory cache hit
      if (getCachedTravelTime(p.originAddress, p.destinationAddress, mode)) return false
      // Skip if DB has a cached duration and mode hasn't been locally changed
      const localMode = localModes.get(pairKey(p.fromEventId, p.toEventId))
      if (p.dbDurationMinutes != null && !localMode) return false
      return true
    })
    if (uncached.length === 0) return

    const generation = ++generationRef.current

    Promise.allSettled(
      uncached.map((p) => {
        const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
        let request: TravelTimeRequest = { mode }
        if (mode === 'transit' && dayDate) {
          request = buildTransitTimeRequest({
            dayDate,
            fromEndTime: p.fromEndTime,
            toStartTime: p.toStartTime,
            fromStartTime: p.fromStartTime,
          })
        }
        return getTravelTime(p.originAddress, p.destinationAddress, request)
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
            // Persist duration to DB (fire-and-forget); skip transit (time-sensitive)
            const duration = result.value[mode]
            if (duration != null && mode !== 'transit') {
              markSelfUpdate(p.fromEventId)
              updateTripEvent(p.fromEventId, { travel_duration_minutes: duration }).catch(() => {
                clearSelfUpdate(p.fromEventId)
              })
            }
          }
        })
        return next
      })
    })
  }, [pairs, modes, localModes, dayDate])

  return useMemo(() => {
    return pairs.map((p) => {
      const mode = modes.get(pairKey(p.fromEventId, p.toEventId)) ?? DEFAULT_MODE
      const cached = getCachedTravelTime(p.originAddress, p.destinationAddress, mode)
      const fetched = fetchedResults.get(resultKey(p.fromEventId, p.toEventId, mode))
      // Use DB cached duration if no in-memory or fetched result available
      const localMode = localModes.get(pairKey(p.fromEventId, p.toEventId))
      const dbTravelTime = p.dbDurationMinutes != null && !localMode
        ? buildTravelTimeForMode(p.dbDurationMinutes, mode)
        : null
      const travelTime = cached ?? fetched ?? dbTravelTime ?? null
      return {
        fromEventId: p.fromEventId,
        toEventId: p.toEventId,
        travelTime,
        isLoading: !travelTime,
        mode,
        setMode: (m: TravelMode) => setModeForPair(p.fromEventId, p.toEventId, m),
      }
    })
  }, [pairs, fetchedResults, modes, localModes, setModeForPair])
}
