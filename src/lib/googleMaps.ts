import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

export type TravelMode = 'walking' | 'transit' | 'driving'

export const TRAVEL_MODES: TravelMode[] = ['walking', 'transit', 'driving']

export function isValidTravelMode(value: string | null | undefined): value is TravelMode {
  return value != null && TRAVEL_MODES.includes(value as TravelMode)
}

export type TravelTime = {
  walking: number | null   // minutes
  transit: number | null   // minutes
  driving: number | null   // minutes
}

export type TravelTimeRequest = {
  mode: TravelMode
  departureTime?: Date
  arrivalTime?: Date
}

export type PlaceDetails = {
  name: string
  address: string | null
  phone: string | null
  openingHours: string | null
  websiteUrl: string | null
  googleMapsUrl: string | null
}

export type PlaceSuggestion = {
  placeId: string
  mainText: string
  secondaryText: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _prediction: any
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AutocompleteSuggestionClass: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AutocompleteSessionTokenClass: any = null
let loadPromise: Promise<void> | null = null

export function isGoogleMapsAvailable(): boolean {
  return !!API_KEY
}

async function ensureLoaded(): Promise<void> {
  if (AutocompleteSuggestionClass) return
  if (loadPromise) {
    await loadPromise
    return
  }

  if (!API_KEY) throw new Error('Google Maps API key not configured')

  loadPromise = (async () => {
    setOptions({ key: API_KEY })
    const placesLib = await importLibrary('places')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lib = placesLib as any
    AutocompleteSuggestionClass = lib.AutocompleteSuggestion
    AutocompleteSessionTokenClass = lib.AutocompleteSessionToken
    if (!AutocompleteSuggestionClass) {
      console.error('[GoogleMaps] AutocompleteSuggestion not found in places library. Available keys:', Object.keys(lib))
    }
  })()

  try {
    await loadPromise
  } catch (e) {
    loadPromise = null
    throw e
  }
}

export async function getAutocompleteSuggestions(
  input: string
): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return []
  try {
    await ensureLoaded()
    if (!AutocompleteSuggestionClass) return []

    const token = new AutocompleteSessionTokenClass()
    const { suggestions } =
      await AutocompleteSuggestionClass.fetchAutocompleteSuggestions({
        input,
        sessionToken: token,
      })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (suggestions as any[]).map((s) => ({
      placeId: s.placePrediction.placeId,
      mainText: s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? '',
      secondaryText: s.placePrediction.secondaryText?.text ?? '',
      _prediction: s.placePrediction,
    }))
  } catch (e) {
    console.error('[GoogleMaps] getAutocompleteSuggestions error:', e)
    return []
  }
}

export async function getPlaceDetails(
  suggestion: PlaceSuggestion
): Promise<PlaceDetails | null> {
  try {
    await ensureLoaded()

    const place = suggestion._prediction.toPlace()
    await place.fetchFields({
      fields: [
        'displayName',
        'formattedAddress',
        'addressComponents',
        'nationalPhoneNumber',
        'regularOpeningHours',
        'websiteURI',
        'googleMapsURI',
      ],
    })

    // addressComponents から国名を取得し、formattedAddress の末尾から除去
    // （", 日本" や " 日本" など区切り文字が異なる場合にも対応）
    const rawAddress: string | null = place.formattedAddress ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countryComponent = (place.addressComponents as any[] | undefined)?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.types?.includes('country')
    )
    let address: string | null = rawAddress
    if (address && countryComponent?.longText) {
      const escaped = countryComponent.longText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // 先頭の「日本、」「日本, 」「日本 」および末尾の「, 日本」「 日本」に対応
      address = address
        .replace(new RegExp('^' + escaped + '[、,\\s]+'), '')
        .replace(new RegExp('[、,\\s]+' + escaped + '$'), '')
        .trim()
    }

    return {
      name: place.displayName ?? suggestion.mainText,
      address,
      phone: place.nationalPhoneNumber ?? null,
      openingHours:
        place.regularOpeningHours?.weekdayDescriptions?.join('\n') ?? null,
      websiteUrl: place.websiteURI ?? null,
      googleMapsUrl: place.googleMapsURI ?? null,
    }
  } catch (e) {
    console.error('[GoogleMaps] getPlaceDetails error:', e)
    return null
  }
}

export function buildTravelTimeForMode(duration: number | null, mode: TravelMode): TravelTime {
  return {
    walking: mode === 'walking' ? duration : null,
    transit: mode === 'transit' ? duration : null,
    driving: mode === 'driving' ? duration : null,
  }
}

// Route Matrix: travel time cache
const travelTimeCache = new Map<string, TravelTime>()

function travelTimeCacheKey(origin: string, destination: string, request: TravelTimeRequest): string {
  let key = `${origin}|${destination}|${request.mode}`
  if (request.departureTime) key += `|d${request.departureTime.getTime()}`
  if (request.arrivalTime) key += `|a${request.arrivalTime.getTime()}`
  return key
}

export function getCachedTravelTime(origin: string, destination: string, mode: TravelMode = 'transit'): TravelTime | undefined {
  return travelTimeCache.get(travelTimeCacheKey(origin, destination, { mode }))
}

export function clearTravelTimeCache(): void {
  travelTimeCache.clear()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RouteMatrixClass: any = null

async function getRouteMatrixClass() {
  if (RouteMatrixClass) return RouteMatrixClass
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routesLib = (await importLibrary('routes')) as any
  RouteMatrixClass = routesLib.RouteMatrix
  return RouteMatrixClass
}

const TRAVEL_MODE_MAP: Record<TravelMode, string> = {
  walking: 'WALKING',
  transit: 'TRANSIT',
  driving: 'DRIVING',
}

async function fetchDuration(
  origin: string,
  destination: string,
  request: TravelTimeRequest,
): Promise<number | null> {
  try {
    const RouteMatrix = await getRouteMatrixClass()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      origins: [origin],
      destinations: [destination],
      travelMode: TRAVEL_MODE_MAP[request.mode],
      fields: ['durationMillis'],
    }
    if (request.departureTime) req.departureTime = request.departureTime
    if (request.arrivalTime) req.arrivalTime = request.arrivalTime

    const response = await RouteMatrix.computeRouteMatrix(req)
    const item = response?.matrix?.rows?.[0]?.items?.[0]
    if (item?.durationMillis != null) {
      return Math.round(item.durationMillis / 60_000)
    }
    return null
  } catch (e) {
    console.error('[RouteMatrix] fetchDuration error', e)
    return null
  }
}

export async function getTravelTime(
  origin: string,
  destination: string,
  request: TravelTimeRequest = { mode: 'transit' },
): Promise<TravelTime> {
  const mode = request.mode
  const cacheKey = travelTimeCacheKey(origin, destination, request)
  const cached = travelTimeCache.get(cacheKey)
  if (cached) return cached

  await ensureLoaded()

  const duration = await fetchDuration(origin, destination, request)

  const travelTime = buildTravelTimeForMode(duration, mode)
  // Transit results are time-sensitive and always re-fetched; skip caching to avoid unbounded growth
  if (mode !== 'transit') {
    travelTimeCache.set(cacheKey, travelTime)
  }
  return travelTime
}
