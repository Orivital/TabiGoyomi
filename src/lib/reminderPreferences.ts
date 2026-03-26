import type { SupabaseClient } from '@supabase/supabase-js'

export type TripEventReminderUserPrefs = {
  user_id: string
  trip_event_id: string
  remind_start_enabled: boolean
  remind_end_enabled: boolean
  /** 終了時刻ぴったりの通知（終了○分前とは独立） */
  remind_end_at_enabled: boolean
  remind_start_minutes_before: number
  remind_end_minutes_before: number
}

export async function fetchReminderMasterEnabled(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_reminder_preferences')
    .select('reminders_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.reminders_enabled ?? false
}

export async function setReminderMasterEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from('user_reminder_preferences').upsert(
    {
      user_id: userId,
      reminders_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

export async function fetchEventReminderPrefs(
  supabase: SupabaseClient,
  userId: string,
  tripEventId: string,
): Promise<TripEventReminderUserPrefs | null> {
  const { data, error } = await supabase
    .from('trip_event_reminder_user_prefs')
    .select('*')
    .eq('user_id', userId)
    .eq('trip_event_id', tripEventId)
    .maybeSingle()
  if (error) throw error
  return data as TripEventReminderUserPrefs | null
}

export async function upsertEventReminderPrefs(
  supabase: SupabaseClient,
  row: TripEventReminderUserPrefs,
): Promise<void> {
  const { error } = await supabase.from('trip_event_reminder_user_prefs').upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,trip_event_id' },
  )
  if (error) throw error
}
