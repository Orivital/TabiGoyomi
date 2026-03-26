import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './pushSubscription'

// eslint-disable-next-line no-secrets/no-secrets -- テスト説明（関数名）の誤検知を抑止
describe('urlBase64ToUint8Array', () => {
  it('decodes URL-safe base64 to bytes', () => {
    const raw = new Uint8Array([1, 2, 3, 4])
    const b64 = btoa(String.fromCharCode(...raw))
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const out = urlBase64ToUint8Array(urlSafe)
    expect(Array.from(out)).toEqual([1, 2, 3, 4])
  })
})
