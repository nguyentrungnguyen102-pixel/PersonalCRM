import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useSettings'

interface LocationState {
  from?: string
}

export function Login() {
  const { t } = useLabels()
  const { session, loading: authLoading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as LocationState | null)?.from ?? '/'

  if (!authLoading && session) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)

    if (signInError) {
      setError(t('auth.wrong_credentials'))
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-6 text-ink">
      <div
        aria-hidden
        className="anim-blob pointer-events-none fixed -top-20 -right-20 h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 65%, rgba(249,115,22,0.1), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-24 -left-16 h-[400px] w-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(251,113,133,0.08), transparent 60%)' }}
      />

      <div className="anim-fi relative z-10 w-full max-w-[380px] rounded-[13px] border border-line bg-card p-8 backdrop-blur-xl">
        <div className="mb-7 text-center">
          <div className="mb-1.5 font-heading text-2xl font-bold">
            <span className="text-primary">Quan</span>He360
          </div>
          <p className="text-xs text-muted">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <div>
            <label
              className="mb-1.5 block text-[10px] tracking-wide text-muted uppercase"
              htmlFor="login-email"
            >
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              className="w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-[10px] tracking-wide text-muted uppercase"
              htmlFor="login-password"
            >
              {t('auth.password')}
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password_placeholder')}
              className="w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {submitting ? t('auth.signing_in') : t('auth.login_button')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
