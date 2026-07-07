// Logic + CRUD mong cho "Viec can lam" (tasks): do khan cap theo han, sap
// xep, va cac ham goi Supabase dung chung boi TasksPanel/Dashboard/Reminders.

import { supabase } from './supabase'
import type { Task } from './types'

export type TaskUrgency = 'overdue' | 'today' | 'upcoming' | 'no_due'

const URGENCY_ORDER: Record<TaskUrgency, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  no_due: 3,
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function taskUrgency(
  task: Pick<Task, 'due_date'>,
  todayIso: string = todayISO(),
): TaskUrgency {
  if (!task.due_date) return 'no_due'
  if (task.due_date < todayIso) return 'overdue'
  if (task.due_date === todayIso) return 'today'
  return 'upcoming'
}

// Sap xep: qua han truoc, roi hom nay, roi han gan nhat, khong han cuoi cung.
export function sortTasks(tasks: Task[], todayIso: string = todayISO()): Task[] {
  return [...tasks].sort((a, b) => {
    const ua = taskUrgency(a, todayIso)
    const ub = taskUrgency(b, todayIso)
    if (ua !== ub) return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
    if (ua === 'upcoming' || ua === 'overdue') {
      return (a.due_date ?? '').localeCompare(b.due_date ?? '')
    }
    return 0
  })
}

// Neu co personId: tra ve toan bo task cua nguoi do (ca da xong, de con "hien
// lai duoc"). Neu khong: tra ve viec CHUA xong (chung + cua moi nguoi).
export async function fetchTasks(personId?: string): Promise<{ data: Task[]; error: string | null }> {
  let query = supabase.from('tasks').select('*')
  query = personId ? query.eq('person_id', personId) : query.eq('done', false)

  const { data, error } = await query.order('created_at', { ascending: false })
  return { data: (data as Task[] | null) ?? [], error: error?.message ?? null }
}

export interface CreateTaskInput {
  title: string
  due_date?: string | null
  person_id?: string | null
  note?: string | null
}

export async function createTask(input: CreateTaskInput): Promise<{ data: Task | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title.trim(),
      due_date: input.due_date || null,
      person_id: input.person_id ?? null,
      note: input.note?.trim() || null,
    })
    .select()
    .single()

  return { data: (data as Task | null) ?? null, error: error?.message ?? null }
}

export async function toggleDone(taskId: string, done: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)

  return { error: error?.message ?? null }
}

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  return { error: error?.message ?? null }
}
