import type { TripDetailLocationState } from '../types/navigation'

/**
 * 旅程詳細のフォーカス日・イベントを location.state と URL クエリから解決する。
 * 通知タップの `?day=&event=` と既存の React Router state を両立する。
 */
export function resolveTripDetailFocus(
  state: TripDetailLocationState | null | undefined,
  dayParam: string | null,
  eventParam: string | null,
): TripDetailLocationState {
  return {
    focusDayDate: state?.focusDayDate ?? dayParam ?? undefined,
    focusEventId: state?.focusEventId ?? eventParam ?? undefined,
  }
}
