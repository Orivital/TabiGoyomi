import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { inviteUser, fetchAllowedUsers } from '../lib/invite'

export function InvitePage() {
  const [email, setEmail] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchAllowedUsers().then((data) => setMembers(data.map((m) => m.email)))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    if (members.includes(trimmed)) {
      setError('このメールアドレスは既に登録されています')
      return
    }
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)
      await inviteUser(trimmed)
      setMembers((prev) => [...prev, trimmed].sort())
      setEmail('')
      setSuccess(
        `${trimmed} を招待しました。${window.location.origin} を共有してください。`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="back-link">
          ← 一覧
        </Link>
        <h1>メンバー招待</h1>
      </header>

      <main className="main">
        <p className="invite-description">
          招待する人のGoogleメールアドレスを入力してください。
          招待後、アプリのURLを共有するとログインできます。
        </p>

        <form onSubmit={handleSubmit} className="invite-form">
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@gmail.com"
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? '招待中...' : '招待する'}
          </button>
        </form>

        <section className="member-list">
          <h3>メンバー一覧</h3>
          <ul>
            {members.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
