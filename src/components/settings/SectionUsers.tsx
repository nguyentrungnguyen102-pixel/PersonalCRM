// Muc "Nguoi dung & Phan quyen" — bang profiles, doi vai tro ghi thang DB
// (khong co nut Luu rieng, moi thay doi hieu luc ngay). Khong the tu ha
// quyen chinh minh (chi chan phia UI — RLS da cho admin sua bat ky ai).
// Ngoai ra co nut moi nguoi dung moi: goi Edge Function invite-user, tao
// tai khoan + mat khau tam, hien 1 lan de admin gui cho nguoi duoc moi.

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '../../hooks/useAuth'
import { useLabels } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import type { Role } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Modal } from '../Modal'

interface SectionUsersProps {
  showToast: (kind: 'success' | 'error', text: string) => void
}

interface UserRow {
  id: string
  display_name: string | null
  role: Role
  created_at: string
}

interface InviteResult {
  email: string
  temp_password: string
  role: Role
}

const ROLES: Role[] = ['admin', 'editor', 'viewer']

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // rơi xuống fallback bên dưới
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  } catch {
    return false
  }
}

export function SectionUsers({ showToast }: SectionUsersProps) {
  const { t } = useLabels()
  const { user } = useAuth()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: true })
    if (!error && data) setRows(data as UserRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleRoleChange(id: string, role: Role) {
    const previous = rows
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, role } : r)))
    setSavingId(id)

    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    setSavingId(null)

    if (error) {
      setRows(previous)
      showToast('error', error.message)
      return
    }
    showToast('success', t('settings.saved'))
  }

  function openInvite() {
    setInviteEmail('')
    setInviteRole('viewer')
    setInviteError(null)
    setInviteResult(null)
    setCopied(false)
    setInviteOpen(true)
  }

  function closeInvite() {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteError(null)
    setInviteResult(null)
    setCopied(false)
  }

  async function handleInviteSubmit(e: FormEvent) {
    e.preventDefault()
    setInviteError(null)

    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setInviteError(t('invite.error'))
      return
    }

    setInviting(true)
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, role: inviteRole },
    })
    setInviting(false)

    if (error) {
      // Khi Edge Function tra ve non-2xx, supabase-js nem FunctionsHttpError
      // voi context la Response goc (data = null) — doc status + body de
      // phan biet loi "email da ton tai" (409, code 'exists') voi loi khac.
      let status: number | undefined
      let code: string | undefined
      if (error instanceof FunctionsHttpError) {
        status = error.context.status
        try {
          const body = await error.context.clone().json()
          code = body?.code
        } catch {
          // body khong phai JSON — bo qua, dung status de phan loai
        }
      }
      if (status === 409 || code === 'exists') {
        setInviteError(t('invite.exists'))
      } else {
        setInviteError(t('invite.error'))
      }
      return
    }

    const result = data as InviteResult
    setInviteResult(result)
    showToast('success', t('invite.created'))
    void loadUsers()
  }

  async function handleCopyPassword() {
    if (!inviteResult) return
    const ok = await copyToClipboard(inviteResult.temp_password)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-ink">{t('settings.users')}</h2>
        <button
          type="button"
          onClick={openInvite}
          className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          ＋ {t('invite.title')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const isSelf = row.id === user?.id
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <Avatar name={row.display_name || '?'} size={32} />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{row.display_name || row.id}</span>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <select
                    value={row.role}
                    disabled={isSelf || savingId === row.id}
                    onChange={(e) => void handleRoleChange(row.id, e.target.value as Role)}
                    className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/50 disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </select>
                  {isSelf && (
                    <span className="text-[10px] text-muted">{t('settings.cannot_demote_self')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={inviteOpen} onClose={closeInvite} title={t('invite.title')} maxWidthClass="md:max-w-sm" center>
        {inviteResult ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs font-medium text-amber">
              {t('invite.created')}
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('invite.email')}
              </span>
              <p className="truncate text-xs text-ink">{inviteResult.email}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('password.new_password')}
              </span>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-bg px-3 py-2 text-sm font-bold whitespace-nowrap text-ink">
                  {inviteResult.temp_password}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyPassword()}
                  className="flex-shrink-0 rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                >
                  {copied ? t('actions.copied') : t('actions.copy')}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={closeInvite}
              className="mt-1 self-start rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('actions.cancel')}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleInviteSubmit(e)} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('invite.email')}
              </span>
              <input
                type="email"
                autoFocus
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('auth.email_placeholder')}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('invite.role')}
              </span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-xs text-ink outline-none focus:border-primary/50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </label>

            {inviteError && (
              <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
                {inviteError}
              </p>
            )}

            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="self-start rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inviting ? '…' : t('invite.send')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}

export default SectionUsers
