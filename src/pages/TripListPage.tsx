import { Link } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips'
import { useAuth } from '../hooks/useAuth'
import { EditableTripCard } from '../components/EditableTripCard'

export function TripListPage() {
  const { trips, isLoading, error, refetch } = useTrips()
  const { signOut } = useAuth()

  if (isLoading) {
    return (
      <div className="page">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <p className="error">エラー: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <h1>旅暦</h1>
        <button type="button" className="btn-secondary" onClick={() => signOut()}>
          ログアウト
        </button>
      </header>

      <main className="main">
        <div className="trip-list-header">
          <h2>旅程一覧</h2>
          <div className="header-actions">
            <Link to="/invite" className="btn-secondary">
              招待
            </Link>
            <Link to="/trips/new" className="btn-primary">
              新規作成
            </Link>
          </div>
        </div>

        {trips.length === 0 ? (
          <p className="empty">旅程がありません。新規作成してください。</p>
        ) : (
          <ul className="trip-list">
            {trips.map((trip) => (
              <li key={trip.id}>
                <EditableTripCard trip={trip} onUpdated={refetch} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
