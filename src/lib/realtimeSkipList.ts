// Track self-initiated DB updates to skip unnecessary realtime reloads.
// Used by optimistic-update hooks to prevent their own writes from
// triggering a full data re-fetch via Supabase realtime subscriptions.

const EXPIRY_MS = 5000

const pending = new Map<string, ReturnType<typeof setTimeout>>()

export function markSelfUpdate(id: string): void {
  const prev = pending.get(id)
  if (prev != null) clearTimeout(prev)
  pending.set(id, setTimeout(() => pending.delete(id), EXPIRY_MS))
}

export function clearSelfUpdate(id: string): void {
  const timer = pending.get(id)
  if (timer != null) clearTimeout(timer)
  pending.delete(id)
}

export function consumeSelfUpdate(id: string): boolean {
  const timer = pending.get(id)
  if (timer == null) return false
  clearTimeout(timer)
  pending.delete(id)
  return true
}
