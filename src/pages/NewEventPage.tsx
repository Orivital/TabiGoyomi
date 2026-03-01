import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { createTripEvent, createTripDay, fetchTripDays } from '../lib/trips'
import { PlaceAutocompleteInput } from '../components/PlaceAutocompleteInput'
import type { PlaceDetails } from '../lib/googleMaps'

type LocationState = {
  dayDate?: string
  isGenerated?: boolean
}

export function NewEventPage() {
  const { tripId, dayId } = useParams<{ tripId: string; dayId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [title, setTitle] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState<string>('')
  const [isReserved, setIsReserved] = useState(false)
  const [isSettled, setIsSettled] = useState(false)
  const [isReservationNotNeeded, setIsReservationNotNeeded] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [openingHours, setOpeningHours] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [showPlaceDetails, setShowPlaceDetails] = useState(true)
  const [isPlaceDetailsOpen, setIsPlaceDetailsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualDayId, setActualDayId] = useState<string | null>(dayId || null)

  // dayDateをuseMemoで計算して依存配列を最適化
  const dayDate = useMemo(() => {
    const state = location.state as LocationState | null
    return state?.dayDate || (dayId?.startsWith('generated-') ? dayId.replace('generated-', '') : null)
  }, [location.state, dayId])

  // 生成された日の場合は、先にtrip_dayを作成
  useEffect(() => {
    const initializeDay = async () => {
      if (!tripId || !dayId || !dayDate) return
      
      // dayIdがgenerated-で始まる場合は、trip_dayを作成
      if (dayId.startsWith('generated-')) {
        try {
          const newDay = await createTripDay({
            trip_id: tripId,
            day_date: dayDate,
          })
          setActualDayId(newDay.id)
        } catch {
          // エラーが発生した場合は、既存のtrip_dayを取得を試みる
          // 重複エラーだけでなく、その他のエラーでも既存の日を探す
          try {
            const existingDays = await fetchTripDays(tripId)
            const existingDay = existingDays.find((d) => d.day_date === dayDate)
            if (existingDay) {
              setActualDayId(existingDay.id)
            }
            // 既存の日が見つからない場合でも、エラーメッセージを表示しない
            // ユーザーは通常の操作を続行できる
          } catch {
            // 取得に失敗してもエラーメッセージを表示しない
            // ユーザーは通常の操作を続行できる
          }
        }
      }
    }
    initializeDay()
  }, [tripId, dayId, dayDate])

  const handlePlaceSelect = (details: PlaceDetails) => {
    setLocationInput(details.name)
    setPhone(details.phone ?? '')
    setAddress(details.address ?? '')
    setOpeningHours(details.openingHours ?? '')
    setWebsiteUrl(details.websiteUrl ?? '')
    setGoogleMapsUrl(details.googleMapsUrl ?? '')
    setShowPlaceDetails(true)
    setIsPlaceDetailsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalDayId = actualDayId || dayId
    if (!tripId || !finalDayId || !title.trim()) return
    try {
      setIsSubmitting(true)
      setError(null)
      const costNum = cost.trim() ? parseInt(cost, 10) : undefined
      await createTripEvent({
        trip_day_id: finalDayId,
        title: title.trim(),
        location: locationInput.trim() || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        description: description.trim() || undefined,
        cost: costNum !== undefined && isNaN(costNum) ? undefined : costNum,
        is_reserved: isReserved,
        is_settled: isSettled,
        is_reservation_not_needed: isReservationNotNeeded,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        opening_hours: openingHours.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        google_maps_url: googleMapsUrl.trim() || undefined,
      })
      navigate(`/trips/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to={`/trips/${tripId}`} className="back-link">← 戻る</Link>
        <h1>予定を追加</h1>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="event-form">
          {error && <p className="error">{error}</p>}
          <label>
            タイトル *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 旭山動物園"
              required
            />
          </label>
          <label>
            場所
            <PlaceAutocompleteInput
              value={locationInput}
              onChange={setLocationInput}
              onPlaceSelect={handlePlaceSelect}
              placeholder="例: 旭山動物園"
            />
          </label>
          {showPlaceDetails && (
            <div className="place-details-section">
              <button
                type="button"
                className="place-details-toggle"
                onClick={() => setIsPlaceDetailsOpen(!isPlaceDetailsOpen)}
              >
                場所の詳細情報 {isPlaceDetailsOpen ? '▼' : '▶'}
              </button>
              <div className={`place-details-fields${isPlaceDetailsOpen ? '' : ' place-details-fields--hidden'}`}>
                <label>
                  住所
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <label>
                  電話番号
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label>
                  営業時間
                  <textarea value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} rows={3} />
                </label>
                <label>
                  ウェブサイト
                  <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                </label>
                <label>
                  Google Maps URL
                  <input type="text" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} />
                </label>
              </div>
            </div>
          )}
          <div className="form-row">
            <label>
              開始時刻
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              終了時刻
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <label>
            メモ
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細やメモ"
              rows={3}
            />
          </label>
          <label>
            費用（円）
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="例: 1500"
              min={0}
              step={1}
            />
          </label>
          <div className="form-section">
            <label>
              予約
              <select
                value={
                  isReserved
                    ? 'reserved'
                    : isReservationNotNeeded
                    ? 'not_needed'
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value
                  setIsReserved(value === 'reserved')
                  setIsReservationNotNeeded(value === 'not_needed')
                }}
              >
                <option value="">選択なし</option>
                <option value="reserved">予約済み</option>
                <option value="not_needed">予約不要</option>
              </select>
            </label>
          </div>
          <div className="form-section">
            <label>
              精算
              <select
                value={isSettled ? 'settled' : ''}
                onChange={(e) => setIsSettled(e.target.value === 'settled')}
              >
                <option value="">選択なし</option>
                <option value="settled">精算済み</option>
              </select>
            </label>
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isSubmitting || (dayId?.startsWith('generated-') && !actualDayId)}
          >
            {isSubmitting ? '追加中...' : '追加'}
          </button>
        </form>
      </main>
    </div>
  )
}
