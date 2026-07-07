// Trang Tong quan (route /): bang "Sap nguoi" noi bat nhat, thong ke, nhom
// noi bat, hoat dong gan day, sinh nhat thang nay va ua thich.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { GROUP_COLORS } from '../components/PersonCard'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import { useLabels, useSettings } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { keepInTouch } from '../lib/keepInTouch'
import { supabase } from '../lib/supabase'
import type { GroupType, InteractionType } from '../lib/types'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']

const URGENCY_HEX: Record<string, string> = {
  rose: '#fb7185',
  amber: '#fbbf24',
}

interface RecentInteraction {
  person_id: string
  date: string
  type: InteractionType
  title: string | null
  note: string | null
  created_at: string
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

export function Dashboard() {
  const { t } = useLabels()
  const { warningDays } = useSettings()
  const { profile, user } = useAuth()
  const { persons, loading: personsLoading } = usePersons()
  const navigate = useNavigate()

  const [interactions, setInteractions] = useState<RecentInteraction[]>([])
  const [interactionsLoading, setInteractionsLoading] = useState(true)

  useEffect(() => {
    let active = true
    setInteractionsLoading(true)

    supabase
      .from('interactions')
      .select('person_id,date,type,title,note,created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setInteractions(data as RecentInteraction[])
        setInteractionsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const displayName = profile?.display_name || user?.email || '?'
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  const sapNguoi = useMemo(() => {
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

  const favoritesCount = useMemo(() => persons.filter((p) => p.is_favorite).length, [persons])

  const interactions30dCount = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - 30)
    return interactions.filter((i) => new Date(i.date) >= cutoff).length
  }, [interactions])

  const topGroups = useMemo(() => {
    const counts = new Map<GroupType, number>()
    for (const g of GROUP_TYPES) counts.set(g, 0)
    for (const p of persons) counts.set(p.group_type, (counts.get(p.group_type) ?? 0) + 1)
    return GROUP_TYPES.map((group) => ({ group, count: counts.get(group) ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [persons])

  const recentActivity = useMemo(() => interactions.slice(0, 8), [interactions])

  const birthdaysThisMonth = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1
    return persons
      .filter((p) => p.birthday)
      .map((p) => ({
        person: p,
        day: Number(p.birthday!.slice(8, 10)),
        month: Number(p.birthday!.slice(5, 7)),
      }))
      .filter((x) => x.month === currentMonth)
      .sort((a, b) => a.day - b.day)
  }, [persons])

  const favorites = useMemo(() => persons.filter((p) => p.is_favorite), [persons])

  const loading = personsLoading || interactionsLoading

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {t('dashboard.greeting')}, {displayName} 👋
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          {sapNguoi.length} {t('dashboard.need_attention')}
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      )}

      {!loading && (
        <>
          {sapNguoi.length > 0 && (
            <div className="mb-5 rounded-card border border-primary/20 bg-primary/5 px-4 py-3.5">
              <div className="mb-2.5 text-xs font-bold text-primary">🌡️ {t('dashboard.sap_nguoi')}</div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {sapNguoi.map(({ person, status }) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => navigate(`/nguoi/${person.id}`)}
                    style={{ borderColor: `${URGENCY_HEX[status.color] ?? '#78716c'}40` }}
                    className="flex min-w-[190px] flex-shrink-0 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:opacity-90"
                  >
                    <Avatar name={personDisplayName(person)} avatarUrl={person.avatar_url} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-ink">{personDisplayName(person)}</div>
                      <Badge result={status} className="mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr_240px]">
            {/* (a) Thong ke + Nhom noi bat */}
            <div>
              <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('dashboard.stats')}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-card p-2.5">
                  <div className="font-mono text-xl font-semibold text-primary">{persons.length}</div>
                  <div className="text-[10px] text-muted">{t('nav.contacts')}</div>
                </div>
                <div className="rounded-lg border border-line bg-card p-2.5">
                  <div className="font-mono text-xl font-semibold text-amber">{favoritesCount}</div>
                  <div className="text-[10px] text-muted">{t('person.favorite')}</div>
                </div>
                <div className="rounded-lg border border-line bg-card p-2.5">
                  <div className="font-mono text-xl font-semibold text-rose">{sapNguoi.length}</div>
                  <div className="text-[10px] leading-tight text-muted">{t('dashboard.sap_nguoi')}</div>
                </div>
                <div className="rounded-lg border border-line bg-card p-2.5">
                  <div className="font-mono text-xl font-semibold text-emerald">{interactions30dCount}</div>
                  <div className="text-[10px] text-muted">{t('dashboard.recent')}</div>
                </div>
              </div>

              <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('dashboard.top_groups')}
              </div>
              <div className="flex flex-col gap-1.5">
                {topGroups.map(({ group, count }) => (
                  <div
                    key={group}
                    className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5"
                  >
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: GROUP_COLORS[group] }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-[11px] text-ink">{t(`groups.${group}`)}</span>
                    <span className="font-mono text-[11px] font-semibold text-muted">{count}</span>
                  </div>
                ))}
                {topGroups.length === 0 && <p className="text-xs text-muted">{t('empty.no_persons')}</p>}
              </div>
            </div>

            {/* (b) Hoat dong gan day */}
            <div className="rounded-card border border-line bg-card p-4">
              <div className="mb-3 font-heading text-sm font-semibold text-ink">{t('dashboard.recent')}</div>
              {recentActivity.length === 0 && (
                <p className="text-xs text-muted">{t('empty.no_interactions')}</p>
              )}
              <div className="flex flex-col gap-3">
                {recentActivity.map((item, idx) => {
                  const p = personById.get(item.person_id)
                  return (
                    <button
                      key={`${item.person_id}-${item.created_at}-${idx}`}
                      type="button"
                      onClick={() => navigate(`/nguoi/${item.person_id}`)}
                      className="flex gap-2.5 border-b border-line pb-3 text-left last:border-b-0 last:pb-0"
                    >
                      <Avatar name={p ? personDisplayName(p) : '?'} avatarUrl={p?.avatar_url} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-ink">
                          {p ? personDisplayName(p) : '—'}
                        </div>
                        {(item.note || item.title) && (
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                            {item.note || item.title}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            {t(`interaction_types.${item.type}`)}
                          </span>
                          <span className="text-[9px] text-muted">{formatDate(item.date)}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* (c) Sinh nhat thang nay + Ua thich */}
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                  {t('dashboard.birthdays')}
                </div>
                <div className="flex flex-col gap-1.5">
                  {birthdaysThisMonth.map(({ person, day, month }) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => navigate(`/nguoi/${person.id}`)}
                      className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-left"
                    >
                      <span aria-hidden>🎂</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{personDisplayName(person)}</span>
                      <span className="font-mono text-[10px] text-muted">
                        {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}
                      </span>
                    </button>
                  ))}
                  {birthdaysThisMonth.length === 0 && (
                    <p className="text-xs text-muted">{t('empty.no_results')}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                  ⭐ {t('dashboard.favorites')}
                </div>
                <div className="flex flex-col gap-1.5">
                  {favorites.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => navigate(`/nguoi/${person.id}`)}
                      className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-left"
                    >
                      <Avatar name={personDisplayName(person)} avatarUrl={person.avatar_url} size={24} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{personDisplayName(person)}</span>
                    </button>
                  ))}
                  {favorites.length === 0 && <p className="text-xs text-muted">{t('empty.no_results')}</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
