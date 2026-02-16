import { useState, useCallback } from 'react'

type Options = {
  initialStart?: string
  initialEnd?: string
  onDateChange?: () => void
}

export function useDateRangeAdjustment(options: Options = {}) {
  const { initialStart = '', initialEnd = '', onDateChange } = options
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)

  const handleStartDateChange = useCallback(
    (newStart: string) => {
      setStartDate(newStart)
      setEndDate((prev) => {
        if (newStart && prev && new Date(newStart) > new Date(prev)) {
          return newStart
        }
        return prev
      })
      onDateChange?.()
    },
    [onDateChange]
  )

  const handleEndDateChange = useCallback(
    (newEnd: string) => {
      if (newEnd && startDate && new Date(newEnd) < new Date(startDate)) {
        setEndDate(startDate)
      } else {
        setEndDate(newEnd)
      }
      onDateChange?.()
    },
    [startDate, onDateChange]
  )

  const getAdjustedEndDate = useCallback(() => {
    return new Date(startDate) > new Date(endDate) ? startDate : endDate
  }, [startDate, endDate])

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handleStartDateChange,
    handleEndDateChange,
    getAdjustedEndDate,
  }
}
