// Quet danh thiep bang camera/anh: OCR client-side (tesseract.js, vie+eng),
// tach cac truong co ban (ten, dien thoai, email, cong ty, chuc danh) bang
// heuristic don gian, roi cho nguoi dung xem/sua truoc khi dung ket qua de
// mo PersonFormModal them moi. tesseract.js CHI duoc import dong (dynamic
// import) de tach thanh chunk rieng, khong tai ve khi chua mo man quet nay.

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLabels } from '../hooks/useSettings'
import { normalizePhone } from '../lib/importCsv'
import { vnNormalize } from '../lib/normalize'
import type { PersonFormInitialValues } from './PersonFormModal'
import { Modal } from './Modal'

interface ScanCardModalProps {
  open: boolean
  onClose: () => void
  onUseResult: (values: PersonFormInitialValues) => void
}

type Step = 'pick' | 'scanning' | 'review'

// ---------------------------------------------------------------------
// Parse text OCR — logic thuan, khong phu thuoc React, de doc/test doc lap.
// ---------------------------------------------------------------------

const PHONE_RE = /(?:\+?84|0)(?:[\s.-]?\d){8,10}/
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

const ADDRESS_KEYWORDS = ['đường', 'street', 'quận', 'district', 'tầng', 'floor']
const COMPANY_KEYWORDS = ['công ty', 'cty', 'jsc', 'co.', 'ltd', 'corp', 'group', 'bank']
const JOB_KEYWORDS = [
  'giám đốc',
  'director',
  'manager',
  'trưởng',
  'ceo',
  'cto',
  'phó',
  'chuyên viên',
  'head',
]

// So sanh khong phan biet hoa/thuong (co dau + khong dau) — OCR co the doc
// sai/mat dau nen thu ca 2 kieu cho chac.
function includesAny(line: string, keywords: string[]): boolean {
  const lower = line.toLocaleLowerCase('vi')
  const plain = vnNormalize(line)
  return keywords.some((k) => lower.includes(k) || plain.includes(vnNormalize(k)))
}

// Ten nguoi kieu Viet: dong ngan (<=6 tu), co >=2 tu viet hoa chu dau.
function isNameCandidate(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  const capitalized = words.filter((w) => /^\p{Lu}/u.test(w))
  return capitalized.length >= 2
}

export interface ScanParsedResult {
  name: string
  phone: string
  email: string
  company: string
  job_title: string
}

export function parseCardText(rawText: string): ScanParsedResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const phoneMatch = PHONE_RE.exec(rawText)
  const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : ''

  const emailMatch = EMAIL_RE.exec(rawText)
  const email = emailMatch ? emailMatch[0].toLowerCase() : ''

  const rest = lines.filter((line) => {
    if (PHONE_RE.test(line)) return false
    if (line.includes('@')) return false
    const lower = line.toLowerCase()
    if (lower.includes('www') || lower.includes('http')) return false
    if (includesAny(line, ADDRESS_KEYWORDS)) return false
    return true
  })

  let company = ''
  let jobTitle = ''
  for (const line of rest) {
    if (!company && includesAny(line, COMPANY_KEYWORDS)) {
      company = line
      continue
    }
    if (!jobTitle && includesAny(line, JOB_KEYWORDS)) {
      jobTitle = line
    }
  }

  const nameLine = rest.find(
    (line) => line !== company && line !== jobTitle && isNameCandidate(line),
  )

  return { name: nameLine ?? '', phone, email, company, job_title: jobTitle }
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ReviewField({ label, value, onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
    </label>
  )
}

export function ScanCardModal({ open, onClose, onUseResult }: ScanCardModalProps) {
  const { t } = useLabels()

  const [step, setStep] = useState<Step>('pick')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)
  const [rawText, setRawText] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const previewUrlRef = useRef<string | null>(null)
  previewUrlRef.current = previewUrl

  useEffect(() => {
    // Don dep object URL khi unmount de tranh ro ri bo nho.
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setStep('pick')
    setPreviewUrl(null)
    setProgress(0)
    setScanError(null)
    setRawText('')
    setName('')
    setPhone('')
    setEmail('')
    setCompany('')
    setJobTitle('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function runOcr(file: File) {
    setStep('scanning')
    setProgress(0)
    setScanError(null)

    try {
      // Import dong bat buoc — tesseract.js kha nang bundle nang (worker +
      // du lieu ngon ngu), chi tai khi nguoi dung thuc su mo man quet nay.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('vie+eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      try {
        const { data } = await worker.recognize(file)
        const text = data.text ?? ''
        setRawText(text)

        if (!text.trim()) {
          setScanError(t('scan.no_text'))
          setStep('pick')
          return
        }

        const parsed = parseCardText(text)
        setName(parsed.name)
        setPhone(parsed.phone)
        setEmail(parsed.email)
        setCompany(parsed.company)
        setJobTitle(parsed.job_title)
        setStep('review')
      } finally {
        await worker.terminate()
      }
    } catch {
      setScanError(t('scan.no_text'))
      setStep('pick')
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    void runOcr(file)
  }

  function handleUseResult() {
    const trimmedName = name.trim()
    onUseResult({
      nickname: trimmedName,
      full_name: trimmedName,
      phone: phone.trim(),
      email: email.trim(),
      company: company.trim(),
      job_title: jobTitle.trim(),
    })
    reset()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('scan.title')} maxWidthClass="md:max-w-md">
      {step === 'pick' && (
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/25 bg-primary/5 px-4 py-10 text-center">
            <span className="text-2xl" aria-hidden>
              📇
            </span>
            <span className="px-4 text-xs text-muted">{t('scan.pick_image')}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {scanError && (
            <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
              {scanError}
            </p>
          )}
        </div>
      )}

      {step === 'scanning' && (
        <div className="flex flex-col items-center gap-3 py-6">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="max-h-40 w-full rounded-lg border border-line object-contain"
            />
          )}
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-center text-xs text-muted">
            {t('scan.scanning')} {progress}%
          </p>
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-3">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="max-h-40 w-full rounded-lg border border-line object-contain"
            />
          )}
          <p className="text-[11px] text-muted">{t('scan.review_hint')}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ReviewField label={t('person.contact_name')} value={name} onChange={setName} />
            </div>
            <ReviewField label={t('person.phone')} value={phone} onChange={setPhone} />
            <ReviewField label={t('person.email')} value={email} onChange={setEmail} />
            <ReviewField label={t('person.company')} value={company} onChange={setCompany} />
            <ReviewField label={t('person.job_title')} value={jobTitle} onChange={setJobTitle} />
          </div>

          {rawText && (
            <details className="rounded-lg border border-line bg-card px-3 py-2">
              <summary className="cursor-pointer text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                Văn bản gốc (OCR)
              </summary>
              <pre className="mt-1.5 max-h-32 overflow-auto text-[10px] leading-relaxed whitespace-pre-wrap text-muted">
                {rawText}
              </pre>
            </details>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleUseResult}
              disabled={!name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t('scan.use_result')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ScanCardModal
