// Dropdown loc theo the (tag) o trang Danh ba — danh sach the distinct + dem,
// tinh tu mang persons da tai phia client (khong goi RPC, viewer cung dung
// duoc). Chon nhieu the = OR.

import { useEffect, useRef, useState } from 'react'
import { useLabels } from '../hooks/useSettings'

export interface TagCount {
  tag: string
  count: number
}

interface TagFilterDropdownProps {
  tagCounts: TagCount[]
  selected: Set<string>
  onToggle: (tag: string) => void
  onClear: () => void
}

export function TagFilterDropdown({ tagCounts, selected, onToggle, onClear }: TagFilterDropdownProps) {
  const { t } = useLabels()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (tagCounts.length === 0) return null

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          selected.size > 0
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-line bg-card text-muted hover:text-ink'
        }`}
      >
        🏷 {t('filters.by_tag')}
        {selected.size > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/25 px-1 text-[10px] font-semibold">
            {selected.size}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold tracking-[0.6px] text-muted uppercase">
              {t('filters.all_tags')}
            </span>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-medium text-primary hover:opacity-80"
              >
                {t('filters.clear')}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {tagCounts.map(({ tag, count }) => {
              const active = selected.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggle(tag)}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    active ? 'bg-primary/15 text-primary' : 'text-ink hover:bg-card'
                  }`}
                >
                  <span className="truncate">{tag}</span>
                  <span className="flex-shrink-0 font-mono text-[10px] text-muted">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TagFilterDropdown
