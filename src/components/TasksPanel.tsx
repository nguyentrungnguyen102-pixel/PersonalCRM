// Panel "Viec can lam": dung o 3 noi — cot phai ho so nguoi (personId), cot
// phai Dashboard (compact, viec chung sap toi) va trang Nhac nho (viec tong).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import {
  createTask,
  deleteTask,
  fetchTasks,
  sortTasks,
  taskUrgency,
  todayISO,
  toggleDone,
} from '../lib/tasks'
import type { Task } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'

function formatDdMm(value: string | null): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, , mm, dd] = match
  return `${dd}/${mm}`
}

interface DueChipProps {
  task: Task
  t: (path: string) => string
}

function DueChip({ task, t }: DueChipProps) {
  const urgency = taskUrgency(task)

  if (urgency === 'overdue') {
    return (
      <span className="rounded-full border border-rose/30 bg-rose/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose">
        {t('tasks.overdue')}
      </span>
    )
  }
  if (urgency === 'today') {
    return (
      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
        {t('tasks.today')}
      </span>
    )
  }
  if (urgency === 'upcoming') {
    return <span className="font-mono text-[9px] text-muted">{formatDdMm(task.due_date)}</span>
  }
  return <span className="text-[9px] text-muted">{t('tasks.no_due')}</span>
}

interface TasksPanelProps {
  personId?: string
  compact?: boolean
}

export function TasksPanel({ personId, compact = false }: TasksPanelProps) {
  const { t } = useLabels()
  const { canEdit, role, user } = useAuth()
  const { persons } = usePersons()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchTasks(personId)
    setTasks(data)
    setLoading(false)
  }, [personId])

  useEffect(() => {
    void load()
  }, [load])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  const personById = useMemo(() => {
    const map = new Map<string, PersonWithMeta>()
    for (const p of persons) map.set(p.id, p)
    return map
  }, [persons])

  const ordered = useMemo(() => {
    const undone = sortTasks(tasks.filter((tk) => !tk.done), todayISO())
    const done = tasks.filter((tk) => tk.done)
    const all = [...undone, ...done]
    return compact ? all.slice(0, 5) : all
  }, [tasks, compact])

  const allDone = tasks.length > 0 && tasks.every((tk) => tk.done)

  async function handleToggle(task: Task) {
    if (!canEdit) return
    const nextDone = !task.done
    setTasks((prev) =>
      prev.map((tk) => (tk.id === task.id ? { ...tk, done: nextDone, done_at: nextDone ? new Date().toISOString() : null } : tk)),
    )
    const { error } = await toggleDone(task.id, nextDone)
    if (error) {
      // reverte optimistic neu loi
      setTasks((prev) =>
        prev.map((tk) => (tk.id === task.id ? { ...tk, done: task.done, done_at: task.done_at } : tk)),
      )
    }
  }

  function canDelete(task: Task): boolean {
    if (!canEdit) return false
    return role === 'admin' || (role === 'editor' && task.created_by === user?.id)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await deleteTask(deleteTarget.id)
    setDeleting(false)
    if (error) {
      setDeleteError(error)
      return
    }
    setDeleteTarget(null)
    showToast(t('tasks.deleted'))
    void load()
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    setAddError(null)
    const { error } = await createTask({
      title: newTitle,
      due_date: newDue || null,
      person_id: personId ?? null,
    })
    setAdding(false)
    if (error) {
      setAddError(error)
      return
    }
    setNewTitle('')
    setNewDue('')
    showToast(t('tasks.saved'))
    void load()
  }

  return (
    <div className="rounded-lg border border-line bg-card px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
          {compact ? t('tasks.upcoming') : t('tasks.title')}
        </div>
      </div>

      {loading && <p className="text-xs text-muted">…</p>}

      {!loading && tasks.length === 0 && <p className="text-xs text-muted">{t('tasks.empty')}</p>}

      {!loading && tasks.length > 0 && allDone && (
        <p className="mb-1.5 text-xs text-muted">{t('tasks.all_done')}</p>
      )}

      {!loading && ordered.length > 0 && (
        <div className="flex flex-col gap-1">
          {ordered.map((task) => {
            const person = task.person_id ? personById.get(task.person_id) : undefined
            return (
              <div key={task.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void handleToggle(task)}
                  aria-label={t('tasks.done')}
                  aria-pressed={task.done}
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                    task.done
                      ? 'border-emerald bg-emerald text-white'
                      : 'border-line text-transparent hover:border-primary/50'
                  } ${canEdit ? '' : 'cursor-default opacity-70'}`}
                >
                  <span className="text-[9px] leading-none">✓</span>
                </button>

                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-xs font-medium ${
                      task.done ? 'text-muted line-through' : 'text-ink'
                    }`}
                  >
                    {task.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <DueChip task={task} t={t} />
                    {!personId && person && (
                      <Link
                        to={`/nguoi/${person.id}`}
                        className="truncate text-[10px] text-muted hover:text-primary"
                      >
                        {personDisplayName(person)}
                      </Link>
                    )}
                  </div>
                </div>

                {canDelete(task) && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(task)}
                    aria-label={t('actions.delete')}
                    className="flex-shrink-0 rounded-md p-1 text-muted transition-colors hover:text-rose"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canEdit && !compact && (
        <form
          onSubmit={handleAdd}
          className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5 sm:flex-row sm:items-center"
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('tasks.task_title')}
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
          />
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? '…' : `+ ${t('tasks.add')}`}
          </button>
        </form>
      )}

      {addError && (
        <p className="mt-2 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
          {addError}
        </p>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        loading={deleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

export default TasksPanel
