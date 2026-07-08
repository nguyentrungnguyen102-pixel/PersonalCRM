// Panel "Lam giau ho so": nut mo tim kiem nhanh tren Google/Facebook/
// LinkedIn/Zalo, o dan link ho tim thay de luu vao social_links, va danh
// sach truong con thieu de nguoi dung biet can bo sung gi.

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'

interface EnrichPanelProps {
  person: PersonWithMeta
  onSaved: () => void
}

interface SearchLinkProps {
  href: string
  label: string
  icon: string
}

function SearchLink({ href, label, icon }: SearchLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-bg/40 px-2 py-2 text-[11px] font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
    >
      <span aria-hidden>{icon}</span>
      <span className="truncate">{label}</span>
    </a>
  )
}

// Nhan dien domain cua link dan vao -> key luu trong social_links.
function detectSocialKey(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) return 'facebook'
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin'
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
    return 'website'
  } catch {
    return 'website'
  }
}

// Cho phep dan link khong co "https://" o dau (vd "facebook.com/abc").
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function EnrichPanel({ person, onSaved }: EnrichPanelProps) {
  const { t } = useLabels()

  const [pastedUrl, setPastedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  const nameForSearch = person.full_name.trim()
  const googleQuery = person.company ? `${nameForSearch} ${person.company}` : nameForSearch
  const googleHref = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`
  const facebookHref = `https://www.facebook.com/search/people/?q=${encodeURIComponent(nameForSearch)}`
  const linkedinHref = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(nameForSearch)}`
  const zaloPhone = person.phone ? person.phone.replace(/\D/g, '') : ''
  const zaloHref = zaloPhone ? `https://zalo.me/${zaloPhone}` : null

  async function handleSaveLink(e: FormEvent) {
    e.preventDefault()
    const url = normalizeUrl(pastedUrl)
    if (!url) return

    setError(null)
    try {
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      setError('Link không hợp lệ')
      return
    }

    const key = detectSocialKey(url)
    const nextSocialLinks = { ...(person.social_links ?? {}), [key]: url }

    setSaving(true)
    const { error: updateError } = await supabase
      .from('persons')
      .update({ social_links: nextSocialLinks })
      .eq('id', person.id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setPastedUrl('')
    showToast(t('enrich.saved'))
    onSaved()
  }

  const missingFields: string[] = []
  if (!person.phone) missingFields.push(t('person.phone'))
  if (!person.email) missingFields.push(t('person.email'))
  if (!person.birthday) missingFields.push(t('person.birthday'))
  if (!person.company) missingFields.push(t('person.company'))
  if (person.group_type === 'khac') missingFields.push(t('groups.khac'))
  if (person.full_name === (person.nickname ?? '')) missingFields.push(t('person.full_name_label'))

  return (
    <div className="relative rounded-lg border border-line bg-card px-3 py-3">
      <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
        {t('enrich.title')}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <SearchLink href={googleHref} label={t('enrich.search_google')} icon="🔎" />
        <SearchLink href={facebookHref} label={t('enrich.search_facebook')} icon="📘" />
        <SearchLink href={linkedinHref} label={t('enrich.search_linkedin')} icon="💼" />
        {zaloHref && <SearchLink href={zaloHref} label={t('enrich.search_zalo')} icon="💬" />}
      </div>

      <form onSubmit={handleSaveLink} className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
        <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
          {t('enrich.paste_hint')}
        </span>
        <div className="flex gap-1.5">
          <input
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            placeholder="https://..."
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={saving || !pastedUrl.trim()}
            className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '…' : t('actions.save')}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-2 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
          {error}
        </p>
      )}

      {missingFields.length > 0 && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <div className="mb-1.5 text-[9px] tracking-[0.8px] text-muted uppercase">
            {t('enrich.missing_fields')}
          </div>
          <div className="flex flex-wrap gap-1">
            {missingFields.map((field) => (
              <span
                key={field}
                className="rounded-full border border-amber/25 bg-amber/10 px-2 py-0.5 text-[10px] text-amber"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

export default EnrichPanel
