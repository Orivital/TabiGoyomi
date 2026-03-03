import { describe, it, expect } from 'vitest'
import { detectInAppBrowser } from './detectInAppBrowser'

describe('detectInAppBrowser', () => {
  it('LINE のインアプリブラウザを検出する', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0'
    expect(detectInAppBrowser(ua)).toBe('LINE')
  })

  it('Instagram のインアプリブラウザを検出する', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0'
    expect(detectInAppBrowser(ua)).toBe('Instagram')
  })

  it('Facebook のインアプリブラウザを検出する (FBAN)', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS]'
    expect(detectInAppBrowser(ua)).toBe('Instagram')
  })

  it('X (Twitter) のインアプリブラウザを検出する', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone'
    expect(detectInAppBrowser(ua)).toBe('X')
  })

  it('通常のブラウザでは検出しない', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    expect(detectInAppBrowser(ua)).toBeNull()
  })

  it('Chrome ブラウザでは検出しない', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(detectInAppBrowser(ua)).toBeNull()
  })
})
