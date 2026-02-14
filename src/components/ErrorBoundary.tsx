import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  copyLogs = () => {
    try {
      const logs = localStorage.getItem('tabigoyomi_debug')
      if (logs) {
        navigator.clipboard.writeText(logs)
        alert('デバッグログをコピーしました。チャットに貼り付けて共有してください。')
      } else {
        alert('ログがありません')
      }
    } catch {
      alert('コピーに失敗しました。Console で localStorage.getItem("tabigoyomi_debug") を実行してください')
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h1>エラーが発生しました</h1>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.copyLogs}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                borderRadius: '8px',
                border: '1px solid #ccc',
                background: '#f5f5f5',
                cursor: 'pointer',
              }}
            >
              デバッグログをコピー
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              再読み込み
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
