import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from '../lib/trips'
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

    const channel = supabase
      .channel(`checklist-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_checklist_items',
          filter: `trip_id=eq.${tripId}`,
        },
        load
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

  const toggleItem = useCallback(async (id: string, isChecked: boolean) => {
    await updateChecklistItem(id, { is_checked: !isChecked })
    await load()
  }, [load])

  const removeItem = useCallback(async (id: string) => {
    await deleteChecklistItem(id)
    await load()
  }, [load])

  const checkedCount = items.filter((i) => i.is_checked).length

  return { items, isLoading, checkedCount, totalCount: items.length, addItem, toggleItem, removeItem }
}
