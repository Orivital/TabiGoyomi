import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

export type TravelMode = 'walking' | 'transit' | 'driving'

export type TravelTime = {
  walking: number | null   // minutes
  transit: number | null   // minutes
  driving: number | null   // minutes
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

// Distance Matrix: travel time cache
const travelTimeCache = new Map<string, TravelTime>()

function travelTimeCacheKey(origin: string, destination: string, mode: TravelMode = 'transit'): string {
  return `${origin}|${destination}|${mode}`
}

export function getCachedTravelTime(origin: string, destination: string, mode: TravelMode = 'transit'): TravelTime | undefined {
  return travelTimeCache.get(travelTimeCacheKey(origin, destination, mode))
}

export function clearTravelTimeCache(): void {
  travelTimeCache.clear()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let distanceMatrixService: any = null

async function getDistanceMatrixService() {
  if (distanceMatrixService) return distanceMatrixService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routesLib = (await importLibrary('routes')) as any
  distanceMatrixService = new routesLib.DistanceMatrixService()
  return distanceMatrixService
}

async function fetchDuration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  origin: string,
  destination: string,
  travelMode: string,
): Promise<number | null> {
  try {
    const result = await service.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = (result as any).rows?.[0]?.elements?.[0]
    if (element?.status === 'OK' && element.duration) {
      return Math.round(element.duration.value / 60)
    }
    return null
  } catch {
    return null
  }
}

const TRAVEL_MODE_MAP: Record<TravelMode, string> = {
  walking: 'WALKING',
  transit: 'TRANSIT',
  driving: 'DRIVING',
}

export async function getTravelTime(
  origin: string,
  destination: string,
  mode: TravelMode = 'transit',
): Promise<TravelTime> {
  const cacheKey = travelTimeCacheKey(origin, destination, mode)
  const cached = travelTimeCache.get(cacheKey)
  if (cached) return cached

  await ensureLoaded()

  const service = await getDistanceMatrixService()

  const duration = await fetchDuration(service, origin, destination, TRAVEL_MODE_MAP[mode])

  const travelTime: TravelTime = {
    walking: mode === 'walking' ? duration : null,
    transit: mode === 'transit' ? duration : null,
    driving: mode === 'driving' ? duration : null,
  }
  travelTimeCache.set(cacheKey, travelTime)
  return travelTime
}
