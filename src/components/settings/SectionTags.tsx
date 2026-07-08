// Muc "The" trong Cai dat — quan ly the (tag) toan he thong qua cac RPC
// list_tags/rename_tag/delete_tag (chi admin duoc goi thao tac ghi, RPC tu
// chan o tang DB). Thao tac truc tiep, khong co nut Luu/Khoi phuc rieng.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLabels } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { ConfirmDialog } from '../ConfirmDialog'

interface SectionTagsProps {
  showToast: (kind: 'success' | 'error', text: string) => void
}

interface TagRow {
  tag: string
  so_nguoi: number
}

export function SectionTags({ showToast }: SectionTagsProps) {
  const { t } = useLabels()
  const [rows, setRows] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(true)

  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [busyTag, setBusyTag] = useState<string | null>(null)
  const [pendingMerge, setPendingMerge] = useState<{ oldTag: string; newTag: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_tags')
    if (!error && data) {
      setRows((data as { tag: string; so_nguoi: number }[]).map((r) => ({ tag: r.tag, so_nguoi: Number(r.so_nguoi) })))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startRename(tag: string) {
    setEditingTag(tag)
    setRenameDraft(tag)
    setActionError(null)
  }

  function cancelRename() {
    setEditingTag(null)
    setRenameDraft('')
  }

  async function doRename(oldTag: string, newTag: string) {
    setBusyTag(oldTag)
    setActionError(null)
    const { error } = await supabase.rpc('rename_tag', { old_tag: oldTag, new_tag: newTag })
    setBusyTag(null)

    if (error) {
      setActionError(error.message)
      showToast('error', error.message)
      return
    }

    setEditingTag(null)
    setPendingMerge(null)
    showToast('success', t('tags.renamed'))
    void load()
  }

  function commitRename() {
    if (!editingTag) return
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === editingTag) {
      cancelRename()
      return
    }

    const clashes = rows.some((r) => r.tag === trimmed && r.tag !== editingTag)
    if (clashes) {
      setPendingMerge({ oldTag: editingTag, newTag: trimmed })
      return
    }
    void doRename(editingTag, trimmed)
  }

  async function doDelete(tag: string) {
    setBusyTag(tag)
    setActionError(null)
    const { error } = await supabase.rpc('delete_tag', { tag_can_xoa: tag })
    setBusyTag(null)

    if (error) {
      setActionError(error.message)
      showToast('error', error.message)
      return
    }

    setDeleteTarget(null)
    showToast('success', t('tags.deleted'))
    void load()
  }

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-ink">{t('tags.title')}</h2>
        <Link to="/goi-y-ten" className="text-[11px] font-medium text-primary hover:opacity-80">
          ✨ {t('names.title')}
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">{t('tags.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const isEditing = editingTag === row.tag
            const isBusy = busyTag === row.tag

            return (
              <div
                key={row.tag}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2.5"
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    className="min-w-[100px] flex-1 rounded-md border border-primary/40 bg-bg px-2 py-1 text-xs text-ink outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{row.tag}</span>
                )}

                <span className="flex-shrink-0 font-mono text-[11px] text-muted">
                  {row.so_nguoi} · {t('tags.count')}
                </span>

                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={commitRename}
                      disabled={isBusy}
                      className="flex-shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isBusy ? '…' : t('actions.save')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      disabled={isBusy}
                      className="flex-shrink-0 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                    >
                      {t('actions.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startRename(row.tag)}
                      className="flex-shrink-0 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                    >
                      {t('tags.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row.tag)}
                      className="flex-shrink-0 rounded-md border border-rose/30 px-2.5 py-1 text-[11px] font-medium text-rose transition-colors hover:bg-rose/10"
                    >
                      {t('actions.delete')}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {actionError && (
        <p className="mt-3 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
          {actionError}
        </p>
      )}

      <ConfirmDialog
        open={pendingMerge !== null}
        loading={busyTag === pendingMerge?.oldTag}
        title={t('tags.rename')}
        message={t('tags.merge_confirm')}
        confirmLabel={t('tags.rename')}
        tone="default"
        onConfirm={() => pendingMerge && void doRename(pendingMerge.oldTag, pendingMerge.newTag)}
        onCancel={() => setPendingMerge(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        loading={busyTag === deleteTarget}
        title={t('actions.delete')}
        message={t('tags.delete_confirm')}
        confirmLabel={t('actions.delete')}
        onConfirm={() => deleteTarget && void doDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default SectionTags
