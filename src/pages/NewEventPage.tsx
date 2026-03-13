import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { createTripEvent, createTripDay, fetchTripDays, uploadReceiptImage } from '../lib/trips'
import { PlaceAutocompleteInput } from '../components/PlaceAutocompleteInput'
import { TimeInput } from '../components/TimeInput'
import type { PlaceDetails } from '../lib/googleMaps'
import type { TripDetailLocationState } from '../types/navigation'

type LocationState = {
  dayDate?: string
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [actualDayId, setActualDayId] = useState<string | null>(dayId || null)
  const state = location.state as LocationState | null
  const dayDate = state?.dayDate ?? (dayId?.startsWith('generated-') ? dayId.replace('generated-', '') : null)

  const createTripDetailState = (focusEventId?: string): TripDetailLocationState | undefined => {
    if (!dayDate) return undefined
    return focusEventId
      ? { focusDayDate: dayDate, focusEventId }
      : { focusDayDate: dayDate }
  }

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
      const newEvent = await createTripEvent({
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
      if (receiptFile) {
        await uploadReceiptImage(newEvent.id, receiptFile)
      }
      navigate(`/trips/${tripId}`, {
        state: createTripDetailState(newEvent.id),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to={`/trips/${tripId}`} state={createTripDetailState()} className="back-link">← 戻る</Link>
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
              <TimeInput value={startTime} onChange={setStartTime} />
            </label>
            <label>
              終了時刻
              <TimeInput value={endTime} onChange={setEndTime} />
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
          <div className="receipt-image-section">
            <span className="receipt-image-label">予約明細画像</span>
            {receiptPreviewUrl ? (
              <div className="receipt-image-preview-wrapper">
                <img
                  src={receiptPreviewUrl}
                  alt="予約明細"
                  className="receipt-image-preview"
                  onClick={() => fileInputRef.current?.click()}
                />
                <button
                  type="button"
                  className="receipt-image-remove-btn"
                  onClick={() => {
                    setReceiptFile(null)
                    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
                    setReceiptPreviewUrl(null)
                  }}
                >
                  画像を削除
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="receipt-image-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="receipt-image-placeholder">タップして画像を選択</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setReceiptFile(file)
                  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
                  setReceiptPreviewUrl(URL.createObjectURL(file))
                }
                e.target.value = ''
              }}
            />
          </div>
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
