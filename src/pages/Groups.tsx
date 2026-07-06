// Trang Nhom (route /nhom): section theo 6 nhom, an nhom rong.

import { useMemo } from 'react'
import { usePersons } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import type { GroupType } from '../lib/types'
import { GROUP_COLORS, PersonCard } from '../components/PersonCard'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']

export function Groups() {
  const { t } = useLabels()
  const { persons, loading, error } = usePersons()

  const grouped = useMemo(() => {
    return GROUP_TYPES.map((group) => ({
      group,
      persons: persons.filter((p) => p.group_type === group),
    })).filter((g) => g.persons.length > 0)
  }, [persons])

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('nav.groups')}</h1>
        <p className="mt-0.5 font-mono text-xs text-muted">{persons.length}</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">{error}</div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('empty.no_persons')}</p>
        </div>
      )}

      {!loading && !error && grouped.length > 0 && (
        <div className="flex flex-col gap-6">
          {grouped.map(({ group, persons: groupPersons }) => {
            const color = GROUP_COLORS[group]
            return (
              <section key={group}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                  <h2 className="font-heading text-sm font-bold text-ink">{t(`groups.${group}`)}</h2>
                  <span className="font-mono text-xs text-muted">{groupPersons.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groupPersons.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Groups
