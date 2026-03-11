import { describe, expect, it, vi } from 'vitest'
import {
  clearVitePreloadRecovery,
  installVitePreloadRecovery,
  type VitePreloadErrorEvent,
} from './vitePreloadRecovery'

function createStorageMock(initialValue: string | null = null, shouldThrow = false) {
  let value = initialValue
  return {
    getItem: vi.fn(() => {
      if (shouldThrow) throw new DOMException('Blocked', 'SecurityError')
      return value
    }),
    setItem: vi.fn((_: string, nextValue: string) => {
      if (shouldThrow) throw new DOMException('Blocked', 'SecurityError')
      value = nextValue
    }),
    removeItem: vi.fn(() => {
      if (shouldThrow) throw new DOMException('Blocked', 'SecurityError')
      value = null
    }),
  }
}

function createEvent(payload?: unknown): VitePreloadErrorEvent {
  const event = new Event('vite:preloadError') as VitePreloadErrorEvent
  event.payload = payload
  return event
}

function createWindowMock(options?: {
  href?: string
  storageValue?: string | null
  storageThrows?: boolean
  name?: string
}) {
  const listeners = new Map<string, (event: Event) => void>()
  const sessionStorage = createStorageMock(options?.storageValue, options?.storageThrows)
  const location = {
    href: options?.href ?? 'https://example.com/trips/1',
    reload: vi.fn(),
  }
  const target = {
    addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
      listeners.set(type, listener)
    }),
    sessionStorage,
    location,
    name: options?.name ?? '',
  }

  return {
    target,
    sessionStorage,
    location,
    dispatchPreloadError(event: Event) {
      listeners.get('vite:preloadError')?.(event)
    },
  }
}

function createStoredMarker(href: string, timestamp = Date.now()) {
  return JSON.stringify({ href, timestamp })
}

describe('vitePreloadRecovery', () => {
  it('preload error 発生時にリロードして既定の例外送出を止める', () => {
    const { target, sessionStorage, location, dispatchPreloadError } = createWindowMock()
    const onError = vi.fn()
    installVitePreloadRecovery({ target, onError })
    const event = createEvent(new Error('ChunkLoadError'))
    const preventDefault = vi.spyOn(event, 'preventDefault')

    dispatchPreloadError(event)

    expect(onError).toHaveBeenCalledWith(event.payload)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'tabigoyomi_vite_preload_recovery',
      expect.any(String),
    )
    expect(location.reload).toHaveBeenCalledOnce()
  })

  it('同じ URL の recent marker は install 後も保持されて再読み込みを繰り返さない', () => {
    const { target, sessionStorage, location, dispatchPreloadError } = createWindowMock({
      storageValue: createStoredMarker('https://example.com/trips/1'),
    })
    installVitePreloadRecovery({ target })
    const event = createEvent()
    const preventDefault = vi.spyOn(event, 'preventDefault')

    dispatchPreloadError(event)

    expect(sessionStorage.removeItem).not.toHaveBeenCalled()
    expect(sessionStorage.setItem).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('sessionStorage が使えなくても fallback で回復できる', () => {
    const { target, location, dispatchPreloadError } = createWindowMock({
      href: 'https://example.com/trips/2',
      storageThrows: true,
    })
    installVitePreloadRecovery({ target })

    dispatchPreloadError(createEvent())

    expect(location.reload).toHaveBeenCalledOnce()
    expect(target.name).toContain('https://example.com/trips/2')
  })

  it('起動成功後に recovery marker をクリアする', () => {
    const { target, sessionStorage } = createWindowMock({
      storageValue: createStoredMarker('https://example.com/trips/1'),
    })

    clearVitePreloadRecovery(target)

    expect(sessionStorage.removeItem).toHaveBeenCalledWith('tabigoyomi_vite_preload_recovery')
  })
})
