import { describe, expect, it } from 'vitest'
import { resolveTripDetailFocus } from './tripDetailFocus'

describe('resolveTripDetailFocus', () => {
  it('prefers location state over query params', () => {
    expect(
      resolveTripDetailFocus(
        { focusDayDate: '2025-06-01', focusEventId: 'ev1' },
        '2025-06-02',
        'ev2',
      ),
    ).toEqual({ focusDayDate: '2025-06-01', focusEventId: 'ev1' })
  })

  it('falls back to query when state is missing', () => {
    expect(resolveTripDetailFocus(null, '2025-06-02', 'ev2')).toEqual({
      focusDayDate: '2025-06-02',
      focusEventId: 'ev2',
    })
  })

  it('handles partial state and query', () => {
    expect(resolveTripDetailFocus({ focusDayDate: '2025-01-01' }, null, 'e')).toEqual({
      focusDayDate: '2025-01-01',
      focusEventId: 'e',
    })
  })
})
