// Bang du lieu chinh nhanh cho Danh ba — thay the/bo sung view The (PersonCard).
// Ho tro sort moi cot, sua tai cho (inline edit, optimistic), chon nhieu +
// thanh hanh dong hang loat (BulkActionBar), phan trang client 50 dong/trang.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels, useSettings } from '../hooks/useSettings'
import { displayName } from '../lib/displayName'
import { vnNormalize } from '../lib/normalize'
import { supabase } from '../lib/supabase'
import { keepInTouch, type KeepInTouchStatus } from '../lib/keepInTouch'
import type { GroupType } from '../lib/types'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { GROUP_COLORS } from './PersonCard'
import { BulkActionBar } from './BulkActionBar'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']
const FREQ_OPTIONS: (number | null)[] = [null, 30, 60, 90, 180]
const STATUS_RANK: Record<KeepInTouchStatus, number> = {
  no_reminder: 0,
  on_track: 1,
  due_soon: 2,
  overdue: 3,
}
const PAGE_SIZE = 50

type SortKey =
  | 'nickname'
  | 'full_name'
  | 'group_type'
  | 'phone'
  | 'email'
  | 'tags'
  | 'contact_frequency_days'
  | 'last_contacted'
  | 'status'

type SortDir = 'asc' | 'desc'
type EditableField =
  | 'nickname'
  | 'full_name'
  | 'group_type'
  | 'phone'
  | 'email'
  | 'tags'
  | 'contact_frequency_days'
type EditingCell = { id: string; field: EditableField } | null
type ToastMsg = { kind: 'success' | 'error'; text: string } | null

interface ContactsTableProps {
  persons: PersonWithMeta[]
  refresh: () => void
  canEdit: boolean
  isAdmin: boolean
}

function formatDateVN(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

const CELL_CLASS = 'px-2.5 py-2 align-middle text-xs text-ink'
const EDIT_INPUT_CLASS =
  'w-full rounded-md border border-primary/40 bg-bg px-1.5 py-1 text-xs text-ink outline-none'

export function ContactsTable({ persons, refresh, canEdit, isAdmin }: ContactsTableProps) {
  const { t } = useLabels()
  const { warningDays, groupDefaults } = useSettings()

  const [rows, setRows] = useState<PersonWithMeta[]>(persons)
  const [sortKey, setSortKey] = useState<SortKey>('nickname')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [toast, setToast] = useState<ToastMsg>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRows(persons)
  }, [persons])

  // Bo cac id da chon nhung khong con nam trong danh sach (vi du bi xoa/loc).
  useEffect(() => {
    setSelected((cur) => {
      if (cur.size === 0) return cur
      const ids = new Set(rows.map((r) => r.id))
      let changed = false
      const next = new Set<string>()
      cur.forEach((id) => {
        if (ids.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : cur
    })
  }, [rows])

  function showToast(kind: 'success' | 'error', text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ kind, text })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  function patchRow(id: string, patch: Partial<PersonWithMeta>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function commitEdit(id: string, field: EditableField, value: unknown, previous: unknown) {
    patchRow(id, { [field]: value } as Partial<PersonWithMeta>)
    setEditingCell(null)

    const { error } = await supabase
      .from('persons')
      .update({ [field]: value })
      .eq('id', id)

    if (error) {
      patchRow(id, { [field]: previous } as Partial<PersonWithMeta>)
      showToast('error', t('table.save_error'))
      return
    }

    showToast('success', t('table.saved'))
    refresh()
  }

  function getSortValue(p: PersonWithMeta, key: SortKey): string | number {
    switch (key) {
      case 'nickname':
        return vnNormalize(displayName(p))
      case 'full_name':
        return vnNormalize(p.full_name)
      case 'group_type':
        return vnNormalize(t(`groups.${p.group_type}`))
      case 'phone':
        return p.phone ?? ''
      case 'email':
        return p.email ?? ''
      case 'tags':
        return vnNormalize(p.tags.join(', '))
      case 'contact_frequency_days':
        return p.contact_frequency_days ?? -1
      case 'status':
        return STATUS_RANK[
          keepInTouch({
            lastContacted: p.last_contacted,
            frequencyDays: p.contact_frequency_days,
            warningDays,
          }).status
        ]
      case 'last_contacted':
        return p.last_contacted ?? ''
      default:
        return ''
    }
  }

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      if (sortKey === 'last_contacted') {
        // Null (chua tung lien lac) luon xep cuoi, bat ke huong sort.
        if (!a.last_contacted && !b.last_contacted) return 0
        if (!a.last_contacted) return 1
        if (!b.last_contacted) return -1
        const diff = new Date(a.last_contacted).getTime() - new Date(b.last_contacted).getTime()
        return sortDir === 'asc' ? diff : -diff
      }

      const av = getSortValue(a, sortKey)
      const bv = getSortValue(b, sortKey)
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), 'vi')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir, warningDays])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function headerClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleOne(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))

  function toggleSelectAllPage() {
    setSelected((cur) => {
      const next = new Set(cur)
      if (allPageSelected) {
        pageRows.forEach((r) => next.delete(r.id))
      } else {
        pageRows.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function SortHeader({ label, sortKeyFor }: { label: string; sortKeyFor: SortKey }) {
    const active = sortKey === sortKeyFor
    return (
      <button
        type="button"
        onClick={() => headerClick(sortKeyFor)}
        className={`flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-[0.6px] uppercase transition-colors ${
          active ? 'text-primary' : 'text-muted hover:text-ink'
        }`}
      >
        {label}
        <span className="w-2.5 text-[8px]" aria-hidden>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    )
  }

  return (
    <div>
      {canEdit && selected.size > 0 && (
        <div className="mb-2 px-1 text-[11px] font-medium text-primary">
          {selected.size} {t('table.selected')}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              {canEdit && (
                <th className="px-2.5 py-2 text-left">
                  <input
                    type="checkbox"
                    aria-label={t('table.select_all')}
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </th>
              )}
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('person.contact_name')} sortKeyFor="nickname" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('person.full_name_label')} sortKeyFor="full_name" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.group')} sortKeyFor="group_type" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.phone')} sortKeyFor="phone" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.email')} sortKeyFor="email" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.tags')} sortKeyFor="tags" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.frequency')} sortKeyFor="contact_frequency_days" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.last_contact')} sortKeyFor="last_contacted" />
              </th>
              <th className="px-2.5 py-2 text-left">
                <SortHeader label={t('table.status')} sortKeyFor="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => {
              const status = keepInTouch({
                lastContacted: p.last_contacted,
                frequencyDays: p.contact_frequency_days,
                warningDays,
              })
              const isEditing = (field: EditableField) =>
                editingCell?.id === p.id && editingCell.field === field

              return (
                <tr key={p.id} className="border-b border-line/60 last:border-b-0 hover:bg-primary/[0.03]">
                  {canEdit && (
                    <td className={CELL_CLASS}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </td>
                  )}

                  {/* Ten danh ba (nickname) — hien thi chinh */}
                  <td className={CELL_CLASS}>
                    {isEditing('nickname') ? (
                      <InlineTextInput
                        initialValue={p.nickname ?? ''}
                        onCommit={(v) => {
                          const trimmed = v.trim()
                          if (!trimmed) {
                            setEditingCell(null)
                            return
                          }
                          void commitEdit(p.id, 'nickname', trimmed, p.nickname)
                        }}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <div
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'nickname' })}
                        className={`flex items-center gap-2 ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        <Avatar name={displayName(p)} avatarUrl={p.avatar_url} size={24} />
                        <span className="truncate font-medium">{displayName(p)}</span>
                      </div>
                    )}
                  </td>

                  {/* Ten day du (full_name) — mo neu con trung nickname (chua co ten that) */}
                  <td className={CELL_CLASS}>
                    {isEditing('full_name') ? (
                      <InlineTextInput
                        initialValue={p.full_name}
                        onCommit={(v) => {
                          const trimmed = v.trim() || p.nickname?.trim() || p.full_name
                          void commitEdit(p.id, 'full_name', trimmed, p.full_name)
                        }}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <span
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'full_name' })}
                        className={`block truncate ${canEdit ? 'cursor-pointer' : ''} ${
                          p.full_name === p.nickname ? 'text-muted' : 'text-ink'
                        }`}
                      >
                        {p.full_name}
                      </span>
                    )}
                  </td>

                  {/* Nhom */}
                  <td className={CELL_CLASS}>
                    {isEditing('group_type') ? (
                      <select
                        autoFocus
                        defaultValue={p.group_type}
                        onChange={(e) =>
                          void commitEdit(p.id, 'group_type', e.target.value as GroupType, p.group_type)
                        }
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingCell(null)
                        }}
                        className={EDIT_INPUT_CLASS}
                      >
                        {GROUP_TYPES.map((g) => (
                          <option key={g} value={g}>
                            {t(`groups.${g}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'group_type' })}
                        className={`flex items-center gap-1.5 ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        <span
                          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: GROUP_COLORS[p.group_type] }}
                          aria-hidden
                        />
                        <span className="truncate text-muted">{t(`groups.${p.group_type}`)}</span>
                      </div>
                    )}
                  </td>

                  {/* SDT */}
                  <td className={CELL_CLASS}>
                    {isEditing('phone') ? (
                      <InlineTextInput
                        initialValue={p.phone ?? ''}
                        onCommit={(v) => void commitEdit(p.id, 'phone', v.trim() || null, p.phone)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <span
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'phone' })}
                        className={`block truncate text-muted ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        {p.phone || '—'}
                      </span>
                    )}
                  </td>

                  {/* Email */}
                  <td className={CELL_CLASS}>
                    {isEditing('email') ? (
                      <InlineTextInput
                        initialValue={p.email ?? ''}
                        onCommit={(v) => void commitEdit(p.id, 'email', v.trim() || null, p.email)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <span
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'email' })}
                        className={`block truncate text-muted ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        {p.email || '—'}
                      </span>
                    )}
                  </td>

                  {/* Tags */}
                  <td className={`${CELL_CLASS} min-w-[140px]`}>
                    {isEditing('tags') ? (
                      <TagsEditor
                        initialValue={p.tags}
                        onCommit={(tags) => void commitEdit(p.id, 'tags', tags, p.tags)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <div
                        onClick={() => canEdit && setEditingCell({ id: p.id, field: 'tags' })}
                        className={`flex flex-wrap gap-1 ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        {p.tags.length === 0 && <span className="text-muted">—</span>}
                        {p.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-primary/15 bg-primary/[0.07] px-1.5 py-0.5 text-[9px] text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                        {p.tags.length > 3 && (
                          <span className="text-[9px] text-muted">+{p.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Nhip */}
                  <td className={CELL_CLASS}>
                    {isEditing('contact_frequency_days') ? (
                      <select
                        autoFocus
                        defaultValue={p.contact_frequency_days ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          void commitEdit(
                            p.id,
                            'contact_frequency_days',
                            raw === '' ? null : Number(raw),
                            p.contact_frequency_days,
                          )
                        }}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingCell(null)
                        }}
                        className={EDIT_INPUT_CLASS}
                      >
                        {FREQ_OPTIONS.map((opt) => (
                          <option key={opt ?? 'none'} value={opt ?? ''}>
                            {opt == null ? t('table.no_frequency') : opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        onClick={() =>
                          canEdit && setEditingCell({ id: p.id, field: 'contact_frequency_days' })
                        }
                        className={`block text-muted ${canEdit ? 'cursor-pointer' : ''}`}
                      >
                        {p.contact_frequency_days == null
                          ? t('table.no_frequency')
                          : `${p.contact_frequency_days}`}
                      </span>
                    )}
                  </td>

                  {/* Lan cuoi — readonly */}
                  <td className={CELL_CLASS}>
                    <span className="text-muted">{formatDateVN(p.last_contacted)}</span>
                  </td>

                  {/* Trang thai — readonly */}
                  <td className={CELL_CLASS}>
                    <Badge result={status} />
                  </td>
                </tr>
              )
            })}

            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 10 : 9}
                  className="px-3 py-8 text-center text-xs text-muted"
                >
                  {t('empty.no_results')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2 text-[11px] text-muted">
        <span>
          {t('table.page')} {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-md border border-line px-2 py-1 transition-colors hover:text-ink disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded-md border border-line px-2 py-1 transition-colors hover:text-ink disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {canEdit && selected.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selected)}
          rows={rows}
          groupDefaults={groupDefaults}
          isAdmin={isAdmin}
          onDone={() => {
            refresh()
            clearSelection()
          }}
          onClear={clearSelection}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg md:bottom-8 ${
            toast.kind === 'success'
              ? 'border-emerald/30 bg-emerald/15 text-emerald'
              : 'border-rose/30 bg-rose/15 text-rose'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Editor tai cho: text don gian.
// ---------------------------------------------------------------------
function InlineTextInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const cancelledRef = useRef(false)

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          cancelledRef.current = true
          onCancel()
        }
      }}
      onBlur={() => {
        if (!cancelledRef.current) onCommit(draft)
      }}
      className={EDIT_INPUT_CLASS}
    />
  )
}

// ---------------------------------------------------------------------
// Editor tai cho: chips tags — Enter them, x xoa, blur (ra ngoai) luu.
// ---------------------------------------------------------------------
function TagsEditor({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string[]
  onCommit: (tags: string[]) => void
  onCancel: () => void
}) {
  const [tags, setTags] = useState<string[]>(initialValue)
  const [input, setInput] = useState('')
  const cancelledRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function addTag() {
    const trimmed = input.trim()
    if (!trimmed) return
    setTags((cur) => (cur.includes(trimmed) ? cur : [...cur, trimmed]))
    setInput('')
  }

  function removeTag(tag: string) {
    setTags((cur) => cur.filter((tg) => tg !== tag))
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancelledRef.current = true
          onCancel()
        }
      }}
      onBlur={(e) => {
        if (cancelledRef.current) return
        if (containerRef.current?.contains(e.relatedTarget as Node)) return
        onCommit(tags)
      }}
      className="flex min-w-[160px] flex-wrap items-center gap-1 rounded-md border border-primary/40 bg-bg p-1"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full border border-primary/15 bg-primary/[0.07] px-1.5 py-0.5 text-[9px] text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-primary/70 hover:text-primary"
            aria-label="x"
          >
            ×
          </button>
        </span>
      ))}
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTag()
          }
        }}
        className="min-w-[60px] flex-1 bg-transparent px-1 py-0.5 text-[10px] text-ink outline-none"
      />
    </div>
  )
}

export default ContactsTable
