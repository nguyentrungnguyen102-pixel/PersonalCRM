// 2 tab: (a) upload anh (nen client neu >5MB), (b) dan link video (domain
// phai thuoc video_domains).

import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useSettings } from '../hooks/useSettings'
import { compressImage } from '../lib/imageCompress'
import { vnNormalize } from '../lib/normalize'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

const MAX_BYTES = 5 * 1024 * 1024

interface MediaAddModalProps {
  open: boolean
  personId: string
  onClose: () => void
  onSaved: () => void
}

function slugify(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const slug = vnNormalize(base)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'anh'
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function MediaAddModal({ open, personId, onClose, onSaved }: MediaAddModalProps) {
  const { t, videoDomains } = useSettings()
  const [tab, setTab] = useState<'photo' | 'video'>('photo')

  // photo tab state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // video tab state
  const [videoUrl, setVideoUrl] = useState('')
  const [videoCaption, setVideoCaption] = useState('')
  const [videoError, setVideoError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  function resetPhoto() {
    setFileName(null)
    setPreviewUrl(null)
    setPendingBlob(null)
    setPhotoCaption('')
    setPhotoError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetVideo() {
    setVideoUrl('')
    setVideoCaption('')
    setVideoError(null)
  }

  function handleClose() {
    resetPhoto()
    resetVideo()
    setTab('photo')
    onClose()
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)
    setPendingBlob(null)
    setPreviewUrl(null)

    if (!file.type.startsWith('image/')) {
      setPhotoError(t('empty.no_media'))
      return
    }

    setProcessing(true)
    try {
      let blob: Blob = file
      if (file.size > MAX_BYTES) {
        blob = await compressImage(file)
        if (blob.size > MAX_BYTES) {
          setPhotoError(t('empty.no_media'))
          setProcessing(false)
          return
        }
      }
      setFileName(file.name)
      setPendingBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch {
      setPhotoError(t('empty.no_media'))
    } finally {
      setProcessing(false)
    }
  }

  async function handleSavePhoto() {
    if (!pendingBlob) return
    setSaving(true)
    setPhotoError(null)

    const timestamp = Date.now()
    const slug = slugify(fileName ?? 'anh')
    const path = `persons/${personId}/${timestamp}_${slug}.jpg`

    const upload = await supabase.storage.from('media').upload(path, pendingBlob, {
      contentType: 'image/jpeg',
    })

    if (upload.error) {
      setSaving(false)
      setPhotoError(upload.error.message)
      return
    }

    const insert = await supabase.from('media').insert({
      person_id: personId,
      type: 'photo',
      storage_path: path,
      caption: photoCaption.trim() || null,
    })

    setSaving(false)

    if (insert.error) {
      setPhotoError(insert.error.message)
      return
    }

    onSaved()
    handleClose()
  }

  async function handleSaveVideo(e: FormEvent) {
    e.preventDefault()
    setVideoError(null)

    const url = videoUrl.trim()
    if (!url) return

    const host = extractHost(url)
    if (!host) {
      setVideoError(t('actions.add_video_link'))
      return
    }

    const allowed = videoDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    if (!allowed) {
      setVideoError(t('actions.add_video_link'))
      return
    }

    setSaving(true)
    const { error } = await supabase.from('media').insert({
      person_id: personId,
      type: 'video_link',
      external_url: url,
      caption: videoCaption.trim() || null,
    })
    setSaving(false)

    if (error) {
      setVideoError(error.message)
      return
    }

    onSaved()
    handleClose()
  }

  const INPUT_CLASS =
    'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

  return (
    <Modal open={open} onClose={handleClose} title={t('person.gallery')} maxWidthClass="md:max-w-md">
      <div className="mb-3 flex gap-1 rounded-lg border border-line bg-card p-1">
        <button
          type="button"
          onClick={() => setTab('photo')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'photo' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'
          }`}
        >
          {t('actions.upload_photo')}
        </button>
        <button
          type="button"
          onClick={() => setTab('video')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'video' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'
          }`}
        >
          {t('actions.add_video_link')}
        </button>
      </div>

      {tab === 'photo' && (
        <div className="flex flex-col gap-3">
          {previewUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-bg/40">
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-primary/25 bg-primary/5 text-center">
              <span className="text-2xl" aria-hidden>
                📷
              </span>
              <span className="px-4 text-[11px] text-muted">{t('actions.upload_photo')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {processing && <p className="text-xs text-muted">…</p>}

          {previewUrl && (
            <>
              <input
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder={t('person.gallery')}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={resetPhoto}
                className="self-start text-[11px] text-muted underline"
              >
                {t('actions.cancel')}
              </button>
            </>
          )}

          {photoError && (
            <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
              {photoError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSavePhoto}
              disabled={!pendingBlob || saving || processing}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '…' : t('actions.save')}
            </button>
          </div>
        </div>
      )}

      {tab === 'video' && (
        <form onSubmit={handleSaveVideo} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('actions.add_video_link')}
            </span>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              required
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('person.gallery')}
            </span>
            <input
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          {videoError && (
            <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
              {videoError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '…' : t('actions.save')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default MediaAddModal
