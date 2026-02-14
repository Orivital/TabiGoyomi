export function DebugPage() {
  const logs = (() => {
    try {
      return localStorage.getItem('tabigoyomi_debug') ?? '[]'
    } catch {
      return '[]'
    }
  })()
  let parsed: unknown[] = []
  try {
    parsed = JSON.parse(logs) as unknown[]
  } catch {
    parsed = []
  }
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>デバッグログ</h1>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  )
}
