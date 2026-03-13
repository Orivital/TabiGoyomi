import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { fetchTripEvent, updateTripEvent, deleteTripEvent, uploadReceiptImage, deleteReceiptImage } from '../lib/trips'
import { PlaceAutocompleteInput } from '../components/PlaceAutocompleteInput'
import { TimeInput } from '../components/TimeInput'
import type { PlaceDetails } from '../lib/googleMaps'
import type { TripDetailLocationState } from '../types/navigation'

export function EditEventPage() {
  const { tripId, eventId } = useParams<{ tripId: string; eventId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as TripDetailLocationState | null
  const backToTripState = state?.focusDayDate ? { focusDayDate: state.focusDayDate, focusEventId: eventId } : undefined
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
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const initialAddressRef = useRef('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!eventId) {
        setIsLoading(false)
        return
      }
      try {
        const event = await fetchTripEvent(eventId)
        setTitle(event.title)
        setLocationInput(event.location ?? '')
        setStartTime(event.start_time ?? '')
        setEndTime(event.end_time ?? '')
        setDescription(event.description ?? '')
        setCost(event.cost != null ? String(event.cost) : '')
        setIsReserved(event.is_reserved ?? false)
        setIsSettled(event.is_settled ?? false)
        setIsReservationNotNeeded(event.is_reservation_not_needed ?? false)
        setPhone(event.phone ?? '')
        setAddress(event.address ?? '')
        initialAddressRef.current = event.address ?? ''
        setOpeningHours(event.opening_hours ?? '')
        setWebsiteUrl(event.website_url ?? '')
        setGoogleMapsUrl(event.google_maps_url ?? '')
        setExistingReceiptUrl(event.receipt_image_url ?? null)
        if (event.phone || event.address || event.opening_hours || event.website_url || event.google_maps_url) {
          setShowPlaceDetails(true)
          setIsPlaceDetailsOpen(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '予定の読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [eventId])

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
    if (!eventId || !title.trim()) return
    try {
      setIsSubmitting(true)
      setError(null)
      const costNum = cost.trim() ? parseInt(cost, 10) : null
      const addressChanged = (address.trim() || null) !== (initialAddressRef.current.trim() || null)
      await updateTripEvent(eventId, {
        title: title.trim(),
        location: locationInput.trim() || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        description: description.trim() || undefined,
        cost: costNum !== null && isNaN(costNum) ? null : costNum,
        is_reserved: isReserved,
        is_settled: isSettled,
        is_reservation_not_needed: isReservationNotNeeded,
        phone: phone.trim() || null,
        address: address.trim() || null,
        opening_hours: openingHours.trim() || null,
        website_url: websiteUrl.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        // 住所変更時はキャッシュ済み移動時間をクリア（再取得させる）
        ...(addressChanged ? { travel_duration_minutes: null } : {}),
      })
      // 予約明細画像の処理
      if (receiptFile) {
        await uploadReceiptImage(eventId, receiptFile)
      } else if (removeReceipt && existingReceiptUrl) {
        await deleteReceiptImage(eventId)
      }
      navigate(`/trips/${tripId}`, { state: backToTripState })
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId || !tripId) return
    if (!window.confirm('この予定を削除しますか？')) return
    try {
      setIsSubmitting(true)
      setError(null)
      await deleteTripEvent(eventId)
      navigate(`/trips/${tripId}`, { state: backToTripState })
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error && !title) {
    return (
      <div className="page">
        <header className="header">
          <Link to={`/trips/${tripId}`} state={backToTripState} className="back-link">← 戻る</Link>
          <h1>予定を編集</h1>
        </header>
        <main className="main">
          <p className="error">{error}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <Link to={`/trips/${tripId}`} state={backToTripState} className="back-link">← 戻る</Link>
        <h1>予定を編集</h1>
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
            {receiptPreviewUrl || (!removeReceipt && existingReceiptUrl) ? (
              <div className="receipt-image-preview-wrapper">
                <img
                  src={receiptPreviewUrl || existingReceiptUrl || ''}
                  alt="予約明細"
                  className="receipt-image-preview"
                  onClick={() => fileInputRef.current?.click()}
                />
                <button
                  type="button"
                  className="receipt-image-remove-btn"
                  onClick={() => {
                    setReceiptFile(null)
                    if (receiptPreviewUrl) {
                      URL.revokeObjectURL(receiptPreviewUrl)
                    }
                    setReceiptPreviewUrl(null)
                    setRemoveReceipt(true)
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
                  setRemoveReceipt(false)
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
          <div className="event-form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '更新中...' : '更新'}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              削除
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
