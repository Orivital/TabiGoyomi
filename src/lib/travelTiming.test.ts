import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildTransitTimeRequest } from './travelTiming'

describe('buildTransitTimeRequest', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('終了時刻を優先して出発時刻を組み立てる', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 9, 0, 0, 0))

    const result = buildTransitTimeRequest({
      dayDate: '2026-03-22',
      fromEndTime: '18:30',
      toStartTime: '19:00',
      fromStartTime: '17:00',
    })

    expect(result.departureTime?.getFullYear()).toBe(2026)
    expect(result.departureTime?.getMonth()).toBe(2)
    expect(result.departureTime?.getDate()).toBe(15)
    expect(result.departureTime?.getHours()).toBe(18)
    expect(result.departureTime?.getMinutes()).toBe(30)
    expect(result.arrivalTime).toBeUndefined()
  })

  it('終了時刻が無い場合は目的地開始時刻を arrivalTime に使う', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 9, 0, 0, 0))

    const result = buildTransitTimeRequest({
      dayDate: '2026-12-20',
      fromEndTime: null,
      toStartTime: '10:00',
      fromStartTime: null,
    })

    expect(result.arrivalTime?.getTime()).toBeGreaterThan(Date.now())
    expect(result.arrivalTime?.getDay()).toBe(new Date(2026, 11, 20).getDay())
    expect(result.arrivalTime?.getMonth()).toBe(2)
    expect(result.arrivalTime?.getDate()).toBe(15)
    expect(result.arrivalTime?.getHours()).toBe(10)
    expect(result.arrivalTime?.getMinutes()).toBe(0)
    expect(result.departureTime).toBeUndefined()
  })

  it('時刻が無い場合は昼を既定値にする', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 9, 0, 0, 0))

    const result = buildTransitTimeRequest({
      dayDate: '2026-03-20',
      fromEndTime: null,
      toStartTime: null,
      fromStartTime: null,
    })

    expect(result.departureTime?.getHours()).toBe(12)
    expect(result.departureTime?.getMinutes()).toBe(0)
  })
})
