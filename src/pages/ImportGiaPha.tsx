// Trang Nhap gia pha tu Excel (route /nhap-gia-pha): wizard 4 buoc — chon
// file (.xlsx/.csv bat ky, khong theo mau) -> ghep cot -> xem truoc (doi
// chieu trung lap + suy luan quan he bo/me-con, vo/chong) -> ket qua. Cau
// truc/style phong theo src/pages/ImportCsv.tsx. Chi admin/editor duoc truy
// cap. Logic thuan nam o src/lib/importFamily.ts.

import { useCallback, useMemo, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import Papa from 'papaparse'
import type { WorkBook } from 'xlsx'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'
import {
  autoDetectMapping,
  buildFamilyDedupePlan,
  mapFamilyRow,
  resolveRelationships,
  runFamilyImport,
} from '../lib/importFamily'
import type {
  ColumnMapping,
  ExistingFamilyPerson,
  FamilyDedupePlan,
  FamilyField,
  FamilyMapped,
  RelPlanItem,
  RunFamilyImportResult,
} from '../lib/importFamily'
import type { ExistingPerson, RawRow } from '../lib/importCsv'

type Step = 'upload' | 'mapping' | 'preview' | 'result'
type RowStatus = 'new' | 'update' | 'error'

// Thu tu hien trong <select> ghep cot — full_name truoc tien vi bat buoc.
const FIELD_ORDER: FamilyField[] = [
  'full_name',
  'nickname',
  'gender',
  'birthday',
  'death_date',
  'death_lunar',
  'father_name',
  'mother_name',
  'spouse_name',
  'generation',
  'branch',
  'hometown',
  'burial_place',
  'biography',
  'phone',
  'email',
  'note',
  'skip',
]

const PREVIEW_LIMIT = 20
const SAMPLE_LIMIT = 3

interface PreviewRow {
  rowIndex: number
  status: RowStatus
  full_name: string
  gender: string
  birthday: string
  reason: string | null
}

function downloadErrorsCsv(nameLabel: string, reasonLabel: string, failed: { name: string; reason: string }[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    [nameLabel, reasonLabel].map(escape).join(','),
    ...failed.map((f) => [f.name, f.reason].map(escape).join(',')),
  ]
  const csv = lines.join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'loi-nhap-gia-pha.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Cat mang cot tho (kieu header:1 cua sheet_to_json) thanh {headers, rows} —
// dong dau tien KHONG rong la header, cac dong sau rong toan bo bi bo qua.
function arrayRowsToRecords(arr: string[][]): { headers: string[]; rows: RawRow[] } {
  const isBlankRow = (r: string[]) => r.every((c) => String(c ?? '').trim() === '')
  const headerIdx = arr.findIndex((r) => !isBlankRow(r))
  if (headerIdx === -1) return { headers: [], rows: [] }

  const headers = arr[headerIdx].map((h) => String(h ?? '').trim())
  const rows: RawRow[] = arr
    .slice(headerIdx + 1)
    .filter((r) => !isBlankRow(r))
    .map((r) => {
      const obj: RawRow = {}
      headers.forEach((h, i) => {
        obj[h] = String(r[i] ?? '').trim()
      })
      return obj
    })

  return { headers, rows }
}

const STATUS_BADGE: Record<RowStatus, string> = {
  new: 'border-emerald/40 bg-emerald/15 text-emerald',
  update: 'border-amber/40 bg-amber/15 text-amber',
  error: 'border-rose/40 bg-rose/15 text-rose',
}

export function ImportGiaPha() {
  const { t } = useLabels()
  const { canEdit } = useAuth()

  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Chon sheet khi file .xlsx co nhieu hon 1 sheet — workbook giu trong ref
  // (khong can re-render khi doi), chi ten sheet nam trong state de hien UI.
  const pendingWorkbookRef = useRef<WorkBook | null>(null)
  const [sheetChoices, setSheetChoices] = useState<string[] | null>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [existingAll, setExistingAll] = useState<ExistingPerson[]>([])
  const [existingFamily, setExistingFamily] = useState<ExistingFamilyPerson[]>([])

  const [mapped, setMapped] = useState<FamilyMapped[]>([])
  const [rowErrors, setRowErrors] = useState<{ rowIndex: number; reason: string }[]>([])
  const [plan, setPlan] = useState<FamilyDedupePlan | null>(null)
  const [relPlan, setRelPlan] = useState<RelPlanItem[]>([])

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<RunFamilyImportResult | null>(null)

  const resetAll = useCallback(() => {
    setStep('upload')
    setDragOver(false)
    setUploadError(null)
    setLoadingFile(false)
    pendingWorkbookRef.current = null
    setSheetChoices(null)
    setHeaders([])
    setFileRows([])
    setMapping([])
    setExistingAll([])
    setExistingFamily([])
    setMapped([])
    setRowErrors([])
    setPlan(null)
    setRelPlan([])
    setRunning(false)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Sau khi da co {headers, rows} (tu xlsx hoac csv): doi chieu voi du lieu
  // hien co, tinh mapping tu dong, chuyen sang buoc ghep cot.
  const finishLoadedFile = useCallback(async (loadedHeaders: string[], rows: RawRow[]) => {
    const { data } = await supabase
      .from('persons')
      .select('id, phone, email, full_name, nickname, birthday, in_family_tree')

    const list = (data ?? []) as {
      id: string
      phone: string | null
      email: string | null
      full_name: string
      nickname: string | null
      birthday: string | null
      in_family_tree: boolean
    }[]

    const existAll: ExistingPerson[] = list.map((p) => ({
      id: p.id,
      phone: p.phone,
      email: p.email,
      full_name: p.full_name,
      birthday: p.birthday,
    }))
    const existFamily: ExistingFamilyPerson[] = list
      .filter((p) => p.in_family_tree)
      .map((p) => ({ id: p.id, full_name: p.full_name, nickname: p.nickname }))

    setHeaders(loadedHeaders)
    setFileRows(rows)
    setExistingAll(existAll)
    setExistingFamily(existFamily)
    setMapping(autoDetectMapping(loadedHeaders))
    setLoadingFile(false)
    setStep('mapping')
  }, [])

  const processSheet = useCallback(
    async (XLSX: typeof import('xlsx'), wb: WorkBook, sheetName: string) => {
      const ws = wb.Sheets[sheetName]
      const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
      const { headers: h, rows } = arrayRowsToRecords(arr)
      if (h.length === 0) {
        setUploadError(t('import.wrong_format'))
        setLoadingFile(false)
        return
      }
      await finishLoadedFile(h, rows)
    },
    [finishLoadedFile, t],
  )

  const handleSheetPick = useCallback(
    async (sheetName: string) => {
      const wb = pendingWorkbookRef.current
      if (!wb) return
      setSheetChoices(null)
      setLoadingFile(true)
      const XLSX = await import('xlsx')
      await processSheet(XLSX, wb, sheetName)
    },
    [processSheet],
  )

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null)
      const name = file.name.toLowerCase()
      const isXlsx = name.endsWith('.xlsx')
      const isCsv = name.endsWith('.csv')

      if (!isXlsx && !isCsv) {
        // Chua co nhan rieng cho "sai dinh dang" o nhom import_family — dung
        // lai key da co cua wizard CSV danh ba (cung y nghia).
        setUploadError(t('import.wrong_format'))
        return
      }

      setLoadingFile(true)
      try {
        if (isCsv) {
          const text = await file.text()
          const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true })
          const h = parsed.meta.fields ?? []
          if (h.length === 0) {
            setUploadError(t('import.wrong_format'))
            setLoadingFile(false)
            return
          }
          await finishLoadedFile(h, parsed.data)
          return
        }

        // .xlsx — SheetJS chi tai khi thuc su can (dynamic import), xem
        // vite.config.ts (chunk 'xlsx' tach rieng khoi vendor).
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })

        if (wb.SheetNames.length > 1) {
          pendingWorkbookRef.current = wb
          setSheetChoices(wb.SheetNames)
          setLoadingFile(false)
          return
        }

        await processSheet(XLSX, wb, wb.SheetNames[0])
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : String(e))
        setLoadingFile(false)
      }
    },
    [t, finishLoadedFile, processSheet],
  )

  const hasFullNameMapped = useMemo(() => mapping.some((m) => m.field === 'full_name'), [mapping])

  const sampleFor = useCallback(
    (header: string): string[] => {
      const samples: string[] = []
      for (const row of fileRows) {
        const v = (row[header] ?? '').trim()
        if (v) samples.push(v)
        if (samples.length >= SAMPLE_LIMIT) break
      }
      return samples
    },
    [fileRows],
  )

  function updateMappingField(header: string, field: FamilyField) {
    setMapping((prev) => prev.map((m) => (m.header === header ? { ...m, field } : m)))
  }

  const goToPreview = useCallback(() => {
    const mappedOk: FamilyMapped[] = []
    const errors: { rowIndex: number; reason: string }[] = []

    fileRows.forEach((row, idx) => {
      const res = mapFamilyRow(row, mapping, idx)
      if ('ok' in res) mappedOk.push(res.ok)
      else errors.push({ rowIndex: idx, reason: res.error })
    })

    const computedPlan = buildFamilyDedupePlan(mappedOk, existingAll)
    const computedRelPlan = resolveRelationships(mappedOk, existingFamily)

    setMapped(mappedOk)
    setRowErrors(errors)
    setPlan(computedPlan)
    setRelPlan(computedRelPlan)
    setStep('preview')
  }, [fileRows, mapping, existingAll, existingFamily])

  const rowStatusByIndex = useMemo(() => {
    const m = new Map<number, RowStatus>()
    plan?.insertRowIndexes.forEach((r) => m.set(r, 'new'))
    plan?.updateRowIndexes.forEach((r) => m.set(r, 'update'))
    for (const e of rowErrors) m.set(e.rowIndex, 'error')
    return m
  }, [plan, rowErrors])

  const previewRows: PreviewRow[] = useMemo(() => {
    const byIndex = new Map<number, FamilyMapped>()
    for (const m of mapped) byIndex.set(m.rowIndex, m)
    const errByIndex = new Map<number, string>()
    for (const e of rowErrors) errByIndex.set(e.rowIndex, e.reason)

    const total = fileRows.length
    const list: PreviewRow[] = []
    for (let i = 0; i < total; i++) {
      const status = rowStatusByIndex.get(i) ?? 'error'
      const m = byIndex.get(i)
      list.push({
        rowIndex: i,
        status,
        full_name: m?.person.full_name ?? '',
        gender: m?.person.gender ? t(`person.gender_${m.person.gender}`) : '',
        birthday: m?.person.birthday ?? '',
        reason: errByIndex.get(i) ?? null,
      })
    }
    return list
  }, [fileRows.length, mapped, rowErrors, rowStatusByIndex, t])

  const nameByRow = useMemo(() => {
    const m = new Map<number, string>()
    for (const mm of mapped) m.set(mm.rowIndex, mm.person.full_name)
    return m
  }, [mapped])

  const relOk = useMemo(() => relPlan.filter((r) => r.status === 'ok'), [relPlan])
  const relReview = useMemo(() => relPlan.filter((r) => r.status !== 'ok'), [relPlan])

  const handleRun = useCallback(async () => {
    if (!plan) return
    setStep('result')
    setRunning(true)
    setProgress({ done: 0, total: plan.inserts.length + plan.updates.length })

    const res = await runFamilyImport(plan, relPlan, (done, total) => setProgress({ done, total }))

    setResult(res)
    setRunning(false)
  }, [plan, relPlan])

  if (!canEdit) {
    return <Navigate to="/" replace />
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const hasValidRows = (plan?.inserts.length ?? 0) + (plan?.updates.length ?? 0) > 0

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('import_family.title')}</h1>
        <p className="mt-1 text-xs text-muted">{t('import_family.intro')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted">
          {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
            <span
              key={s}
              className={`flex items-center gap-1.5 ${step === s ? 'text-primary' : ''}`}
            >
              {i > 0 && <span className="text-muted">→</span>}
              {t(`import_family.step_${s}`)}
            </span>
          ))}
        </div>
      </div>

      {step === 'upload' && (
        <div className="max-w-xl">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void handleFile(file)
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-14 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-line bg-card'
            }`}
          >
            <span className="text-3xl" aria-hidden>
              🌳
            </span>
            <p className="text-sm text-muted">{t('import_family.drop_hint')}</p>
          </div>

          {loadingFile && (
            <div className="mt-4 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            </div>
          )}

          {uploadError && (
            <div className="mt-4 rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
              {uploadError}
            </div>
          )}

          {sheetChoices && (
            <div className="mt-4 rounded-card border border-line bg-card p-4">
              <div className="mb-2 text-xs font-medium text-ink">{t('import_family.sheet_pick')}</div>
              <div className="flex flex-wrap gap-2">
                {sheetChoices.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleSheetPick(s)}
                    className="rounded-lg border border-line bg-bg px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-primary/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'mapping' && (
        <div>
          <div className="mb-5 overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-3 py-2 font-medium">{t('import_family.col_data')}</th>
                  <th className="px-3 py-2 font-medium">{t('import_family.preview_sample')}</th>
                  <th className="px-3 py-2 font-medium">{t('import_family.col_field')}</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => {
                  const current = mapping.find((m) => m.header === h)?.field ?? 'skip'
                  return (
                    <tr key={h} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{h}</td>
                      <td className="px-3 py-2 text-muted">{sampleFor(h).join(', ') || '—'}</td>
                      <td className="px-3 py-2">
                        <select
                          value={current}
                          onChange={(e) => updateMappingField(h, e.target.value as FamilyField)}
                          className="w-full min-w-[180px] rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/40"
                        >
                          {FIELD_ORDER.map((f) => (
                            <option key={f} value={f}>
                              {f === 'skip' ? t('import_family.col_skip') : t(`import_family.field_${f}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!hasFullNameMapped && (
            <p className="mb-4 rounded-card border border-amber/30 bg-amber/5 px-4 py-3 text-xs text-amber">
              {t('import_family.need_name')}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              disabled={!hasFullNameMapped}
              onClick={goToPreview}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('import_family.step_preview')}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && plan && (
        <div>
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-emerald">{plan.inserts.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import_family.stat_new')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-amber">{plan.updates.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import_family.stat_update')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-rose">{rowErrors.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import_family.stat_error')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-primary">{relOk.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import_family.stat_rel')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-amber">{relReview.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import_family.stat_rel_review')}</div>
            </div>
          </div>

          <div className="mb-5 overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-3 py-2 font-medium">{t('table.name')}</th>
                  <th className="px-3 py-2 font-medium">{t('person.gender')}</th>
                  <th className="px-3 py-2 font-medium">{t('person.birthday')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, PREVIEW_LIMIT).map((entry) => (
                  <tr key={entry.rowIndex} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{entry.full_name || '—'}</td>
                    <td className="px-3 py-2">{entry.gender || '—'}</td>
                    <td className="px-3 py-2 font-mono">{entry.birthday || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[entry.status]}`}
                      >
                        {entry.status === 'new'
                          ? t('import_family.stat_new')
                          : entry.status === 'update'
                            ? t('import_family.stat_update')
                            : t('import_family.stat_error')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {relReview.length > 0 && (
            <div className="mb-5 rounded-card border border-amber/30 bg-amber/5 p-4">
              <div className="mb-2 text-xs font-semibold text-amber">{t('import_family.stat_rel_review')}</div>
              <div className="flex flex-col gap-1.5">
                {relReview.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink">
                    <span className="font-medium">{nameByRow.get(r.fromRow) ?? '—'}</span>
                    <span className="text-muted">→</span>
                    <span>{r.targetName}</span>
                    <span className="text-muted">
                      ({r.status === 'ambiguous' ? t('import_family.ambiguous') : t('import_family.not_found')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              disabled={!hasValidRows}
              onClick={() => void handleRun()}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('import_family.run')}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-xl">
          {running && (
            <div className="mb-5">
              <div className="mb-2 text-xs text-muted">{t('import_family.importing')}</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted">{percent}%</div>
            </div>
          )}

          {!running && result && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="rounded-card border border-line bg-card px-4 py-3">
                  <div className="font-mono text-xl font-bold text-emerald">{result.inserted}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{t('import.inserted')}</div>
                </div>
                <div className="rounded-card border border-line bg-card px-4 py-3">
                  <div className="font-mono text-xl font-bold text-amber">{result.updated}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{t('import.updated')}</div>
                </div>
                <div className="rounded-card border border-line bg-card px-4 py-3">
                  <div className="font-mono text-xl font-bold text-rose">{result.failed.length}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{t('import.failed')}</div>
                </div>
                <div className="rounded-card border border-line bg-card px-4 py-3">
                  <div className="font-mono text-xl font-bold text-primary">{result.relCreated}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{t('import_family.rel_created')}</div>
                </div>
                <div className="rounded-card border border-line bg-card px-4 py-3">
                  <div className="font-mono text-xl font-bold text-muted">{result.relDuplicate}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{t('import_family.rel_skipped')}</div>
                </div>
              </div>

              <p className="mb-4 text-sm text-ink">{t('import_family.done')}</p>

              {result.failed.length > 0 && (
                <div className="mb-4 overflow-x-auto rounded-card border border-rose/30 bg-rose/5">
                  <table className="w-full min-w-[320px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-rose/20 text-[11px] text-muted">
                        <th className="px-3 py-2 font-medium">{t('table.name')}</th>
                        <th className="px-3 py-2 font-medium">{t('import.reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failed.map((f, i) => (
                        <tr key={i} className="border-b border-rose/10 last:border-0">
                          <td className="px-3 py-2">{f.name}</td>
                          <td className="px-3 py-2 text-rose">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {result.failed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => downloadErrorsCsv(t('table.name'), t('import.reason'), result.failed)}
                    className="rounded-lg border border-line bg-card px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
                  >
                    {t('import.download_errors')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-lg border border-line bg-card px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
                >
                  {t('import.try_again')}
                </button>
                <Link
                  to="/gia-pha"
                  className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('import_family.open_giapha')}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ImportGiaPha
