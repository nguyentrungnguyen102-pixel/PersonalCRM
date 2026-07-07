// Trang Goi y ten day du (route /goi-y-ten): quet ghi chu (notes) tim cac
// ban ghi ma notes trong giong ho ten Viet day du va chua co full_name rieng
// (full_name dang = nickname). Duyet chon roi ap dung full_name = notes.
// Chi admin/editor duoc truy cap (giong /nhap-danh-ba).

import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { displayName } from '../lib/displayName'
import { supabase } from '../lib/supabase'

// Ho ten Viet: 2-6 tu, moi tu bat dau bang chu hoa (ke ca cac nguyen am/Đ co
// dau hoa), phan con lai la chu thuong — \p{Lu}/\p{Ll} da tu loai CJK/ky tu
// khong phai chu (khong co case) nen khong can whitelist rieng tung ky tu.
const VIETNAMESE_NAME_RE = /^\p{Lu}\p{Ll}*(?:\s+\p{Lu}\p{Ll}*){1,5}$/u
const MAX_LEN = 40

function looksLikeFullName(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? '').trim()
  if (!trimmed || trimmed.length > MAX_LEN) return null
  if (!VIETNAMESE_NAME_RE.test(trimmed)) return null
  return trimmed
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function NameSuggestions() {
  const { t } = useLabels()
  const { canEdit } = useAuth()
  const { persons, refresh } = usePersons()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState(false)

  const candidates = useMemo(() => {
    return persons
      .filter((p) => !appliedIds.has(p.id))
      .filter((p) => p.full_name === p.nickname)
      .map((p) => ({ person: p, suggestion: looksLikeFullName(p.notes) }))
      .filter((x): x is { person: PersonWithMeta; suggestion: string } => x.suggestion !== null)
  }, [persons, appliedIds])

  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.person.id))

  function toggleOne(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set()
      return new Set(candidates.map((c) => c.person.id))
    })
  }

  async function handleApply() {
    const targets = candidates.filter((c) => selected.has(c.person.id))
    if (targets.length === 0) return

    setApplying(true)
    const okIds: string[] = []

    for (const group of chunk(targets, 20)) {
      const results = await Promise.all(
        group.map((c) =>
          supabase.from('persons').update({ full_name: c.suggestion }).eq('id', c.person.id),
        ),
      )
      results.forEach((res, i) => {
        if (!res.error) okIds.push(group[i].person.id)
      })
    }

    setApplying(false)
    setAppliedIds((cur) => {
      const next = new Set(cur)
      okIds.forEach((id) => next.add(id))
      return next
    })
    setSelected((cur) => {
      const next = new Set(cur)
      okIds.forEach((id) => next.delete(id))
      return next
    })
    setToast(true)
    setTimeout(() => setToast(false), 2000)
    refresh()
  }

  if (!canEdit) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-1.5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('names.title')}</h1>
      </div>
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted">{t('names.description')}</p>
      <p className="mb-4 font-mono text-xs text-muted">
        {candidates.length} {t('names.found')}
      </p>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('names.empty')}</p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-2.5 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label={t('table.select_all')}
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                  </th>
                  <th className="px-2.5 py-2 text-left text-[10px] font-semibold tracking-[0.6px] text-muted uppercase">
                    {t('person.contact_name')}
                  </th>
                  <th className="px-2.5 py-2 text-left text-[10px] font-semibold tracking-[0.6px] text-muted uppercase">
                    {t('person.notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(({ person, suggestion }) => (
                  <tr
                    key={person.id}
                    className="border-b border-line/60 last:border-b-0 hover:bg-primary/[0.03]"
                  >
                    <td className="px-2.5 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(person.id)}
                        onChange={() => toggleOne(person.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </td>
                    <td className="px-2.5 py-2 align-middle text-xs text-ink">{displayName(person)}</td>
                    <td className="px-2.5 py-2 align-middle text-xs font-semibold text-ink">{suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={applying || selected.size === 0}
              onClick={() => void handleApply()}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? '…' : t('names.apply')}
            </button>
            {selected.size > 0 && (
              <span className="text-[11px] text-muted">
                {selected.size} {t('table.selected')}
              </span>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {t('names.applied')}
        </div>
      )}
    </div>
  )
}

export default NameSuggestions
