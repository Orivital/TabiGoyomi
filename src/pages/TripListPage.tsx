import { Link } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips'
import { useAuth } from '../hooks/useAuth'
import { EditableTripCard } from '../components/EditableTripCard'
import { BrandLogo } from '../components/BrandLogo'
import type { Trip } from '../types/database'

/**
 * 旅程を年ごとにグループ化する
 * @param trips 旅程の配列
 * @returns 年をキーとしたグループ化されたオブジェクト
 */
function groupTripsByYear(trips: Trip[]): Record<string, Trip[]> {
  return trips.reduce<Record<string, Trip[]>>((acc, trip) => {
    // YYYY-MM-DD形式を前提とするが、エラーハンドリングを追加
    const year = trip.start_date?.slice(0, 4)
    if (!year || year.length !== 4 || !/^\d{4}$/.test(year)) {
      // 不正な形式の場合は 'unknown' として扱う
      const key = 'unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(trip)
      return acc
    }
    if (!acc[year]) acc[year] = []
    acc[year].push(trip)
    return acc
  }, {})
}

export function TripListPage() {
  const { trips, tripCosts, isLoading, error, refetch } = useTrips()
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
        <BrandLogo />
        <h1 className="visually-hidden">旅程一覧</h1>
        <button type="button" className="btn-logout" onClick={() => signOut()}>
          ログアウト
        </button>
      </header>

      <main className="main">
        <div className="trip-list-header">
          <Link to="/trips/new" className="btn-primary">
            新規作成
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="empty">旅程がありません。新規作成してください。</p>
        ) : (() => {
          const grouped = groupTripsByYear(trips)
          const years = Object.keys(grouped).sort((a, b) => {
            // 'unknown' は最後に表示
            if (a === 'unknown') return 1
            if (b === 'unknown') return -1
            return Number(b) - Number(a)
          })
          return years.map((year) => (
            <section key={year}>
              <h3 className="trip-year-heading">{year === 'unknown' ? '日付不明' : `${year}年`}</h3>
              <ul className="trip-list">
                {grouped[year]?.map((trip) => (
                  <li key={trip.id}>
                    <EditableTripCard trip={trip} totalCost={tripCosts[trip.id] ?? null} onUpdated={refetch} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        })()}
      </main>
    </div>
  )
}
