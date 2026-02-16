import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page">
      <h1>ページが見つかりません</h1>
      <p>指定されたURLは存在しません。</p>
      <Link to="/" className="back-link">トップページへ</Link>
    </div>
  )
}
