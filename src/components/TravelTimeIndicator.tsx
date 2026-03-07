import { TRAVEL_MODES } from '../lib/googleMaps'
import type { TravelTime, TravelMode } from '../lib/googleMaps'

type Props = {
  travelTime: TravelTime | null
  isLoading: boolean
  mode: TravelMode
  onModeChange: (mode: TravelMode) => void
}

const MODE_ICONS: Record<TravelMode, string> = {
  walking: '🚶',
  transit: '🚃',
  driving: '🚗',
}

const MODE_ORDER = TRAVEL_MODES

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  return `${minutes}m`
}

export function TravelTimeIndicator({ travelTime, isLoading, mode, onModeChange }: Props) {
  const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length] ?? 'walking'

  if (isLoading) {
    return (
      <div className="travel-time-indicator travel-time-loading">
        <span className="travel-time-dot" />
        <span className="travel-time-dot" />
        <span className="travel-time-dot" />
      </div>
    )
  }

  if (!travelTime) return null

  const duration = travelTime[mode]

  return (
    <button
      type="button"
      className="travel-time-indicator travel-time-btn"
      onClick={() => onModeChange(nextMode)}
    >
      <span className="travel-time-mode">
        {MODE_ICONS[mode]} {duration != null ? formatMinutes(duration) : '--'}
      </span>
    </button>
  )
}
