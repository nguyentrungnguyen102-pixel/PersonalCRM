// Muc "Nguoi dung & Phan quyen" — bang profiles, doi vai tro ghi thang DB
// (khong co nut Luu rieng, moi thay doi hieu luc ngay). Khong the tu ha
// quyen chinh minh (chi chan phia UI — RLS da cho admin sua bat ky ai).

import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLabels } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import type { Role } from '../../lib/types'
import { Avatar } from '../Avatar'

interface SectionUsersProps {
  showToast: (kind: 'success' | 'error', text: string) => void
}

interface UserRow {
  id: string
  display_name: string | null
  role: Role
  created_at: string
}

const ROLES: Role[] = ['admin', 'editor', 'viewer']

export function SectionUsers({ showToast }: SectionUsersProps) {
  const { t } = useLabels()
  const { user } = useAuth()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setRows(data as UserRow[])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <h2 className="mb-4 font-heading text-sm font-bold text-ink">{t('settings.users')}</h2>

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
    </div>
  )
}

export default SectionUsers
