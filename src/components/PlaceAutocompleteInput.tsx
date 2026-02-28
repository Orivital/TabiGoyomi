import { useState, useRef, useEffect, useCallback } from 'react'
import {
  isGoogleMapsAvailable,
  getAutocompleteSuggestions,
  getPlaceDetails,
} from '../lib/googleMaps'
import type { PlaceDetails, PlaceSuggestion } from '../lib/googleMaps'

type Props = {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (details: PlaceDetails) => void
  placeholder?: string
}

export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(false)

  const available = isGoogleMapsAvailable()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim()) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    try {
      const results = await getAutocompleteSuggestions(input)
      setSuggestions(results)
      setIsOpen(results.length > 0)
    } catch {
      setSuggestions([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    selectedRef.current = false
    onChange(val)

    if (!available) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val)
    }, 300)
  }

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    selectedRef.current = true
    setIsOpen(false)
    setSuggestions([])
    onChange(suggestion.mainText)

    const details = await getPlaceDetails(suggestion)
    if (details) {
      onPlaceSelect(details)
    }
  }

  if (!available) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div className="place-autocomplete" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (selectedRef.current) return
          if (suggestions.length > 0) {
            setIsOpen(true)
          } else if (value.trim()) {
            fetchSuggestions(value)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isLoading && (
        <div className="place-autocomplete-loading">検索中...</div>
      )}
      {isOpen && suggestions.length > 0 && (
        <ul className="place-autocomplete-dropdown">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="place-autocomplete-item"
                onClick={() => handleSelect(s)}
              >
                <span className="place-autocomplete-main">{s.mainText}</span>
                <span className="place-autocomplete-secondary">{s.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
