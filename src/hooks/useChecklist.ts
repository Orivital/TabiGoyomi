import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from '../lib/trips'
import { ConcurrentModificationError } from '../lib/errors'
import type { TripChecklistItem } from '../types/database'

export function useChecklist(tripId: string | null) {
  const [items, setItems] = useState<TripChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tripId) {
      setItems([])
      setIsLoading(false)
      return
    }
    try {
      const data = await fetchChecklistItems(tripId)
      setItems(data)
    } catch (e) {
      console.error('Failed to load checklist:', e)
    } finally {
      setIsLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!tripId) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    const channelName = `checklist-${tripId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timer = window.setTimeout(() => {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trip_checklist_items',
            filter: `trip_id=eq.${tripId}`,
          },
          () => {
            void load()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trip_checklist_items',
            filter: `trip_id=eq.${tripId}`,
          },
          () => {
            void load()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'trip_checklist_items',
          },
          () => {
            void load()
          }
        )
        .subscribe((status, err) => {
          console.log('[useChecklist] Realtime subscribe status:', status, err ?? '')
        })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [tripId, load])

  const addItem = useCallback(
    async (title: string) => {
      if (!tripId) return
      const maxOrder = items.length > 0
        ? Math.max(...items.map((i) => i.sort_order))
        : -1
      await createChecklistItem({
        trip_id: tripId,
        title,
        sort_order: maxOrder + 1,
      })
      await load()
    },
    [tripId, items, load]
  )

  const toggleItem = useCallback(
    async (id: string, isChecked: boolean) => {
      const item = items.find((i) => i.id === id)
      if (!item) return
      try {
        await updateChecklistItem(id, { is_checked: !isChecked }, { expectedUpdatedAt: item.updated_at })
        await load()
      } catch (e) {
        if (e instanceof ConcurrentModificationError) {
          await load()
          return
        }
        console.error('Failed to toggle checklist item:', e)
      }
    },
    [load, items]
  )

  const removeItem = useCallback(async (id: string) => {
    await deleteChecklistItem(id)
    await load()
  }, [load])

  const checkedCount = items.filter((i) => i.is_checked).length

  return { items, isLoading, checkedCount, totalCount: items.length, addItem, toggleItem, removeItem }
}
