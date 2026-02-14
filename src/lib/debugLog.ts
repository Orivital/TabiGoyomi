const DEBUG_KEY = 'tabigoyomi_debug'
const MAX_ENTRIES = 50

function append(entry: object) {
  try {
    const raw = localStorage.getItem(DEBUG_KEY)
    const arr: object[] = raw ? JSON.parse(raw) : []
    arr.push({ ...entry, ts: new Date().toISOString() })
    if (arr.length > MAX_ENTRIES) arr.shift()
    localStorage.setItem(DEBUG_KEY, JSON.stringify(arr))
  } catch {
    // ignore
  }
}

export function debugLog(location: string, message: string, data?: object) {
  const entry = { location, message, data }
  append(entry)
  if (import.meta.env.DEV) {
    const url = import.meta.env.VITE_DEBUG_INGEST_URL
    if (url) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, timestamp: Date.now() }),
      }).catch(() => {})
    }
  }
}

export function captureError(source: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  append({ location: source, message: 'ERROR', data: { msg, stack } })
}
