const VITE_PRELOAD_RECOVERY_KEY = 'tabigoyomi_vite_preload_recovery'
const VITE_PRELOAD_RECOVERY_FALLBACK_PREFIX = '__tabigoyomi_vite_preload_recovery__:'
const VITE_PRELOAD_RECOVERY_TTL_MS = 30_000

export type VitePreloadErrorEvent = Event & {
  payload?: unknown
}

type RecoveryMarker = {
  href: string
  timestamp: number
}

type RecoveryWindow = {
  addEventListener: Window['addEventListener']
  sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  location: Pick<Location, 'href' | 'reload'>
  name: string
}

type InstallVitePreloadRecoveryOptions = {
  target: RecoveryWindow
  onError?: (error: unknown) => void
}

function readStoredValue(target: RecoveryWindow) {
  try {
    return target.sessionStorage.getItem(VITE_PRELOAD_RECOVERY_KEY)
  } catch {
    return target.name.startsWith(VITE_PRELOAD_RECOVERY_FALLBACK_PREFIX)
      ? target.name.slice(VITE_PRELOAD_RECOVERY_FALLBACK_PREFIX.length)
      : null
  }
}

function writeStoredValue(target: RecoveryWindow, value: string) {
  try {
    target.sessionStorage.setItem(VITE_PRELOAD_RECOVERY_KEY, value)
  } catch {
    target.name = `${VITE_PRELOAD_RECOVERY_FALLBACK_PREFIX}${value}`
  }
}

function clearStoredValue(target: RecoveryWindow) {
  try {
    target.sessionStorage.removeItem(VITE_PRELOAD_RECOVERY_KEY)
  } catch {
    // ignore
  }

  if (target.name.startsWith(VITE_PRELOAD_RECOVERY_FALLBACK_PREFIX)) {
    target.name = ''
  }
}

function readRecoveryMarker(target: RecoveryWindow): RecoveryMarker | null {
  const rawMarker = readStoredValue(target)
  if (!rawMarker) return null

  try {
    const marker = JSON.parse(rawMarker) as RecoveryMarker
    if (typeof marker.href !== 'string' || typeof marker.timestamp !== 'number') {
      return null
    }
    return marker
  } catch {
    return null
  }
}

function writeRecoveryMarker(target: RecoveryWindow, marker: RecoveryMarker) {
  writeStoredValue(target, JSON.stringify(marker))
}

function isRecentMarker(marker: RecoveryMarker | null, href: string) {
  return !!marker && marker.href === href && Date.now() - marker.timestamp < VITE_PRELOAD_RECOVERY_TTL_MS
}

export function clearVitePreloadRecovery(target: RecoveryWindow) {
  clearStoredValue(target)
}

export function installVitePreloadRecovery({
  target,
  onError,
}: InstallVitePreloadRecoveryOptions) {
  const initialMarker = readRecoveryMarker(target)
  if (initialMarker && !isRecentMarker(initialMarker, target.location.href)) {
    clearStoredValue(target)
  }

  target.addEventListener('vite:preloadError', (event: Event) => {
    const preloadErrorEvent = event as VitePreloadErrorEvent
    const currentHref = target.location.href

    onError?.(preloadErrorEvent.payload)

    if (isRecentMarker(readRecoveryMarker(target), currentHref)) {
      return
    }

    preloadErrorEvent.preventDefault()
    writeRecoveryMarker(target, {
      href: currentHref,
      timestamp: Date.now(),
    })
    target.location.reload()
  })
}
