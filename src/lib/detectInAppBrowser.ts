/**
 * インアプリブラウザ（WebView）を検出する。
 * Google OAuth はインアプリブラウザからの認証を禁止しているため、
 * 該当環境ではユーザーに外部ブラウザでの利用を案内する。
 *
 * @returns 検出されたアプリ名（例: "LINE"）。通常ブラウザの場合は null。
 */

const IN_APP_BROWSER_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bLine\b/i, name: 'LINE' },
  { pattern: /\bFBAN\b|\bFBAV\b|\bInstagram\b/i, name: 'Instagram' },
  { pattern: /\bTwitter\b/i, name: 'X' },
]

export function detectInAppBrowser(
  userAgent: string = navigator.userAgent,
): string | null {
  for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return name
    }
  }
  return null
}
