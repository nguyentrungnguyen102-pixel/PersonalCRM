// Sao lưu toàn bộ dữ liệu (persons, interactions, media, relationships,
// tasks) thành các file CSV (mở được bằng Excel, không vỡ dấu tiếng Việt
// nhờ BOM UTF-8) đóng gói trong 1 file .zip kèm metadata.json. Chỉ admin
// được gọi (Settings đã guard admin-only, SectionBackup double-check role).

import JSZip from 'jszip'
import { supabase } from './supabase'

// Thứ tự bảng xuất — cũng là thứ tự tệp trong file zip.
const BACKUP_TABLES = ['persons', 'interactions', 'media', 'relationships', 'tasks'] as const
type BackupTable = (typeof BACKUP_TABLES)[number]

// Danh sách cột cố định cho từng bảng (khớp schema) — dùng làm header CSV để
// file luôn có đủ cột kể cả khi bảng rỗng (select * không trả về hàng nào
// thì không có cách nào suy ra tên cột từ dữ liệu).
const TABLE_COLUMNS: Record<BackupTable, string[]> = {
  persons: [
    'id', 'full_name', 'nickname', 'group_type', 'avatar_url', 'phone', 'email',
    'birthday', 'company', 'job_title', 'address', 'hometown', 'hobbies',
    'preferences', 'gift_ideas', 'how_we_met', 'social_links', 'tags',
    'is_favorite', 'contact_frequency_days', 'notes', 'created_by',
    'created_at', 'updated_at',
  ],
  interactions: [
    'id', 'person_id', 'date', 'type', 'title', 'note', 'location',
    'created_by', 'created_at',
  ],
  media: [
    'id', 'person_id', 'interaction_id', 'type', 'storage_path', 'external_url',
    'caption', 'taken_at', 'uploaded_by', 'created_at',
  ],
  relationships: [
    'id', 'person_a', 'person_b', 'relation_type', 'direction_label_a_to_b',
    'direction_label_b_to_a', 'note', 'created_by', 'created_at',
  ],
  tasks: [
    'id', 'person_id', 'title', 'note', 'due_date', 'done', 'done_at',
    'created_by', 'created_at',
  ],
}

const PAGE_SIZE = 1000
const BOM = '﻿'

export interface BackupProgress {
  table: BackupTable
  tableIndex: number
  totalTables: number
}

export type BackupProgressCallback = (progress: BackupProgress) => void

// Lay toan bo hang cua 1 bang, phan trang 1000 hang/lan (persons ~900 hang
// hien tai chi can 1 lan, nhung viet phan trang de an toan khi du lieu lon
// len hoac ap dung cho cac bang khac).
async function fetchAllRows(table: BackupTable): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

// Escape 1 truong theo RFC4180: bao trong dau nhay kep neu co phay, nhay
// kep hoac xuong dong; nhay kep ben trong duoc nhan doi.
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Chuyen 1 gia tri cell thanh chuoi: mang -> join ';', object (jsonb) ->
// JSON.stringify, null/undefined -> chuoi rong, con lai -> String(v).
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join(';')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(escapeCsvField).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(cellToString(row[c]))).join(','))
  }
  return lines.join('\r\n')
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Xuat toan bo du lieu ra 1 file .zip chua CSV cho tung bang + metadata.json,
// roi kich hoat tai xuong ngay trong trinh duyet. onProgress bao tien do
// theo tung bang dang xu ly (danh cho spinner/label trang thai o UI).
export async function exportBackup(onProgress?: BackupProgressCallback): Promise<void> {
  const zip = new JSZip()
  const counts: Record<string, number> = {}

  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const table = BACKUP_TABLES[i]
    onProgress?.({ table, tableIndex: i, totalTables: BACKUP_TABLES.length })

    const rows = await fetchAllRows(table)
    counts[table] = rows.length
    const csv = rowsToCsv(TABLE_COLUMNS[table], rows)
    zip.file(`${table}.csv`, BOM + csv)
  }

  const metadata = {
    exported_at: new Date().toISOString(),
    app: 'PersonalCRM',
    counts,
  }
  zip.file('metadata.json', BOM + JSON.stringify(metadata, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `personalcrm_backup_${todayStr()}.zip`)
}
