import type { TravelTimeRequest } from './googleMaps'

const DEFAULT_TRANSIT_TIME = '12:00'
const MINIMUM_TRANSIT_LEAD_MS = 5 * 60 * 1000
const SEVEN_DAYS = 7

type TransitQueryTimeInput = {
  dayDate: string
  fromEndTime: string | null
  toStartTime: string | null
  fromStartTime: string | null
}

function parseHourMinute(time: string): { hours: number; minutes: number } {
  const [hoursText, minutesText] = time.slice(0, 5).split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return { hours: 12, minutes: 0 }
  }
  return { hours, minutes }
}

function getWeekday(dayDate: string): number {
  const [yearText, monthText, dayText] = dayDate.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  return new Date(year, month - 1, day).getDay()
}

function buildUpcomingWeekdayDateTime(weekday: number, time: string): Date {
  const now = new Date()
  const { hours, minutes } = parseHourMinute(time)
  const next = new Date(now)
  const offsetDays = (weekday - now.getDay() + SEVEN_DAYS) % SEVEN_DAYS
  next.setDate(now.getDate() + offsetDays)
  next.setHours(hours, minutes, 0, 0)
  const minimumTarget = Date.now() + MINIMUM_TRANSIT_LEAD_MS
  while (next.getTime() <= minimumTarget) {
    next.setDate(next.getDate() + SEVEN_DAYS)
  }
  return next
}

export function buildTransitTimeRequest({
  dayDate,
  fromEndTime,
  toStartTime,
  fromStartTime,
}: TransitQueryTimeInput): TravelTimeRequest {
  const weekday = getWeekday(dayDate)
  if (fromEndTime) {
    return {
      mode: 'transit',
      departureTime: buildUpcomingWeekdayDateTime(weekday, fromEndTime),
    }
  }
  if (toStartTime) {
    return {
      mode: 'transit',
      arrivalTime: buildUpcomingWeekdayDateTime(weekday, toStartTime),
    }
  }
  if (fromStartTime) {
    return {
      mode: 'transit',
      departureTime: buildUpcomingWeekdayDateTime(weekday, fromStartTime),
    }
  }
  return {
    mode: 'transit',
    departureTime: buildUpcomingWeekdayDateTime(weekday, DEFAULT_TRANSIT_TIME),
  }
}
