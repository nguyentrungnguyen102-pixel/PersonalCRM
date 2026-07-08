// Trang Nhap danh ba (route /nhap-danh-ba): wizard 3 buoc doc file CSV xuat
// tu Google Contacts, doi chieu trung lap voi du lieu hien co, roi nhap vao
// bang persons. Chi admin/editor duoc truy cap.

import { useCallback, useMemo, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'
import {
  dedupePlan,
  findMatchingExisting,
  mapLinkedInRow,
  mapRow,
  parseContactsCsv,
  runImport,
} from '../lib/importCsv'
import type {
  CsvFormat,
  DedupePlan,
  ExistingPerson,
  MappedPerson,
  RawRow,
  RunImportResult,
} from '../lib/importCsv'

type Step = 'upload' | 'preview' | 'result'
type RowStatus = 'new' | 'update' | 'error'

interface PreviewEntry {
  rowNumber: number
  status: RowStatus
  full_name: string
  phone: string
  email: string
  company: string
  tags: string[]
  reason: string | null
}

const PREVIEW_LIMIT = 20

// Dinh dang LinkedIn/Google dung ham anh xa va so khop trung khac nhau — 1
// nguon lua chon duy nhat de dung ca o preview lan o handleFile.
function mapperFor(format: CsvFormat) {
  return format === 'linkedin' ? mapLinkedInRow : mapRow
}

function isLooseNameMatch(format: CsvFormat) {
  return format === 'linkedin'
}

// Cac cot tho dung de hien preview khi 1 dong loi (khong anh xa duoc) — ten
// cot khac nhau giua 2 dinh dang.
function rawFallback(row: RawRow, format: CsvFormat) {
  if (format === 'linkedin') {
    return {
      full_name: [row['First Name'], row['Last Name']].filter(Boolean).join(' '),
      phone: '',
      email: row['Email Address'] || '',
      company: row['Company'] || '',
    }
  }
  return {
    full_name: [row['First Name'], row['Middle Name'], row['Last Name']].filter(Boolean).join(' '),
    phone: row['Phone 1 - Value'] || '',
    email: row['E-mail 1 - Value'] || '',
    company: row['Organization Name'] || '',
  }
}

function buildPreviewEntries(
  rows: RawRow[],
  existing: ExistingPerson[],
  format: CsvFormat,
): PreviewEntry[] {
  const mapper = mapperFor(format)
  const looseNameMatch = isLooseNameMatch(format)

  return rows.map((row, idx) => {
    const { person, error } = mapper(row)

    if (error || !person) {
      return {
        rowNumber: idx + 1,
        status: 'error',
        ...rawFallback(row, format),
        tags: [],
        reason: error,
      }
    }

    const match = findMatchingExisting(person, existing, looseNameMatch)
    return {
      rowNumber: idx + 1,
      status: match ? 'update' : 'new',
      full_name: person.full_name,
      phone: person.phone || '',
      email: person.email || '',
      company: person.company || '',
      tags: person.tags,
      reason: null,
    }
  })
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
  a.download = 'loi-nhap-danh-ba.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_BADGE: Record<RowStatus, string> = {
  new: 'border-emerald/40 bg-emerald/15 text-emerald',
  update: 'border-amber/40 bg-amber/15 text-amber',
  error: 'border-rose/40 bg-rose/15 text-rose',
}

export function ImportCsv() {
  const { t } = useLabels()
  const { canEdit } = useAuth()

  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [totalRows, setTotalRows] = useState(0)
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([])
  const [plan, setPlan] = useState<DedupePlan | null>(null)
  const [csvFormat, setCsvFormat] = useState<CsvFormat>('unknown')

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<RunImportResult | null>(null)

  const errorEntries = useMemo(
    () => previewEntries.filter((e) => e.status === 'error'),
    [previewEntries],
  )

  const resetAll = useCallback(() => {
    setStep('upload')
    setDragOver(false)
    setUploadError(null)
    setLoadingPreview(false)
    setTotalRows(0)
    setPreviewEntries([])
    setPlan(null)
    setCsvFormat('unknown')
    setRunning(false)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null)

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadError(t('import.not_csv'))
        return
      }

      setLoadingPreview(true)
      try {
        const { rows, format } = await parseContactsCsv(file)

        if (format === 'unknown') {
          setUploadError(t('import.wrong_format'))
          setLoadingPreview(false)
          return
        }

        const { data, error: existingError } = await supabase
          .from('persons')
          .select('id, phone, email, full_name, birthday')

        const existing = (existingError || !data ? [] : data) as ExistingPerson[]

        const mapper = mapperFor(format)
        const looseNameMatch = isLooseNameMatch(format)

        const validPersons: MappedPerson[] = []
        for (const row of rows) {
          const { person } = mapper(row)
          if (person) validPersons.push(person)
        }

        const computedPlan = dedupePlan(validPersons, existing, looseNameMatch)
        const entries = buildPreviewEntries(rows, existing, format)

        setTotalRows(rows.length)
        setPreviewEntries(entries)
        setPlan(computedPlan)
        setCsvFormat(format)
        setStep('preview')
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoadingPreview(false)
      }
    },
    [t],
  )

  const handleRun = useCallback(async () => {
    if (!plan) return
    setStep('result')
    setRunning(true)
    setProgress({ done: 0, total: plan.inserts.length + plan.updates.length })

    const res = await runImport(plan, (done, total) => setProgress({ done, total }))

    setResult(res)
    setRunning(false)
  }, [plan])

  if (!canEdit) {
    return <Navigate to="/" replace />
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const hasValidRows = (plan?.inserts.length ?? 0) + (plan?.updates.length ?? 0) > 0

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('import.title')}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted">
          {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
            <span
              key={s}
              className={`flex items-center gap-1.5 ${step === s ? 'text-primary' : ''}`}
            >
              {i > 0 && <span className="text-muted">→</span>}
              {t(`import.step_${s}`)}
            </span>
          ))}
        </div>
      </div>

      {step === 'upload' && (
        <div className="max-w-xl">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
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
              📄
            </span>
            <p className="text-sm text-muted">{t('import.drop_hint')}</p>
          </div>

          {loadingPreview && (
            <div className="mt-4 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            </div>
          )}

          {uploadError && (
            <div className="mt-4 rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && plan && (
        <div>
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {csvFormat === 'linkedin' ? '💼 LinkedIn' : '📇 Google Contacts'}
            </span>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold">{totalRows}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import.total')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-emerald">{plan.inserts.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import.will_insert')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-amber">{plan.updates.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import.will_update')}</div>
            </div>
            <div className="rounded-card border border-line bg-card px-4 py-3">
              <div className="font-mono text-xl font-bold text-rose">{errorEntries.length}</div>
              <div className="mt-0.5 text-[11px] text-muted">{t('import.has_error')}</div>
            </div>
          </div>

          <div className="mb-5 overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-3 py-2 font-medium">{t('table.name')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.phone')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.email')}</th>
                  <th className="px-3 py-2 font-medium">{t('person.company')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.tags')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {previewEntries.slice(0, PREVIEW_LIMIT).map((entry) => (
                  <tr key={entry.rowNumber} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{entry.full_name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{entry.phone || '—'}</td>
                    <td className="px-3 py-2">{entry.email || '—'}</td>
                    <td className="px-3 py-2">{entry.company || '—'}</td>
                    <td className="px-3 py-2">{entry.tags.join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[entry.status]}`}
                      >
                        {entry.status === 'new'
                          ? t('import.will_insert')
                          : entry.status === 'update'
                            ? t('import.will_update')
                            : t('import.has_error')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errorEntries.length > 0 && (
            <div className="mb-5 overflow-x-auto rounded-card border border-rose/30 bg-rose/5">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-rose/20 text-[11px] text-muted">
                    <th className="px-3 py-2 font-medium">{t('import.row')}</th>
                    <th className="px-3 py-2 font-medium">{t('import.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {errorEntries.map((entry) => (
                    <tr key={entry.rowNumber} className="border-b border-rose/10 last:border-0">
                      <td className="px-3 py-2 font-mono">{entry.rowNumber}</td>
                      <td className="px-3 py-2 text-rose">
                        {entry.reason ? t(entry.reason) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              {t('import.run')}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-xl">
          {running && (
            <div className="mb-5">
              <div className="mb-2 text-xs text-muted">{t('import.importing')}</div>
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
              <div className="mb-5 grid grid-cols-3 gap-2.5">
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
              </div>

              <p className="mb-4 text-sm text-ink">{t('import.done')}</p>

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
                  to="/danh-ba"
                  className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('nav.contacts')}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ImportCsv
