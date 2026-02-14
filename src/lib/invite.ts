import { supabase } from './supabase'

export async function inviteUser(email: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    throw new Error('ログインが必要です')
  }

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email: email.trim().toLowerCase() },
  })

  if (error) throw error

  if (data?.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error.message ?? '招待に失敗しました'
    if (msg.includes('already invited')) {
      throw new Error('このメールアドレスは既に招待されています')
    }
    throw new Error(msg)
  }
}

export async function fetchAllowedUsers() {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email')
    .order('email')

  if (error) throw error
  return data as { email: string }[]
}
