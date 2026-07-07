// Trang Nhac nho (route /nhac-nho): toan bo person "sap nguoi"/qua han,
// sort khan cap nhat truoc.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { GROUP_COLORS } from '../components/PersonCard'
import { usePersons } from '../hooks/usePersons'
import { useLabels, useSettings } from '../hooks/useSettings'
import { displayName } from '../lib/displayName'
import { keepInTouch } from '../lib/keepInTouch'

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

export function Reminders() {
  const { t } = useLabels()
  const { warningDays } = useSettings()
  const { persons, loading, error } = usePersons()
  const navigate = useNavigate()

  const list = useMemo(() => {
    return persons
      .filter((p) => p.contact_frequency_days != null)
      .map((p) => ({
        person: p,
        status: keepInTouch({
          lastContacted: p.last_contacted,
          frequencyDays: p.contact_frequency_days,
          warningDays,
        }),
      }))
      .filter((x) => x.status.status === 'due_soon' || x.status.status === 'overdue')
      .sort((a, b) => (a.status.daysLeft ?? 0) - (b.status.daysLeft ?? 0))
  }, [persons, warningDays])

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('nav.reminders')}</h1>
        <p className="mt-0.5 font-mono text-xs text-muted">{list.length}</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">{error}</div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('empty.no_results')}</p>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="flex flex-col gap-2">
          {list.map(({ person, status }) => {
            const color = GROUP_COLORS[person.group_type]
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => navigate(`/nguoi/${person.id}`)}
                className="flex items-center gap-3 rounded-card border border-line bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/30"
              >
                <Avatar name={displayName(person)} avatarUrl={person.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{displayName(person)}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ background: `${color}18`, color, borderColor: `${color}40` }}
                    >
                      <span className="h-1 w-1 rounded-full" style={{ background: color }} aria-hidden />
                      {t(`groups.${person.group_type}`)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {t('person.last_contact')}:{' '}
                    {formatDate(person.last_contacted) ?? t('person.no_contact_yet')}
                    {person.contact_frequency_days != null && (
                      <span className="ml-1.5 font-mono">· {person.contact_frequency_days}</span>
                    )}
                  </div>
                </div>
                <Badge result={status} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Reminders
