// Nut doi anh dai dien cho 1 person — dung o PersonFormModal.tsx (khi sua
// nguoi da co) va PersonPanel.tsx (gia pha). Luon nen anh (compressImage)
// truoc khi upload de tranh anh dai dien qua nang; luu path (khong phai URL
// day du) vao persons.avatar_url, cung bucket 'media' + tien to
// persons/<id>/ nhu MediaAddModal.tsx de RLS storage hien co ap dung duoc
// luon, khong can chinh sach moi.

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLabels } from '../hooks/useSettings'
import { invalidateAvatarUrl } from '../lib/avatarUrl'
import { compressImage } from '../lib/imageCompress'
import { supabase } from '../lib/supabase'
import { Avatar } from './Avatar'

interface AvatarUploadProps {
  personId: string
  currentUrl: string | null
  name: string
  onSaved: () => void
}

export function AvatarUpload({ personId, currentUrl, name, onSaved }: AvatarUploadProps) {
  const { t } = useLabels()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError(t('person.avatar_error'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      const blob = await compressImage(file)
      const path = `persons/${personId}/avatar_${Date.now()}.jpg`

      const upload = await supabase.storage.from('media').upload(path, blob, {
        contentType: 'image/jpeg',
      })
      if (upload.error) throw upload.error

      const { error: updateError } = await supabase
        .from('persons')
        .update({ avatar_url: path })
        .eq('id', personId)
      if (updateError) throw updateError

      invalidateAvatarUrl(path)
      setUploading(false)
      onSaved()
    } catch (err) {
      setUploading(false)
      setError(err instanceof Error ? err.message : t('person.avatar_error'))
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} avatarUrl={currentUrl} size={56} />
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="self-start rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors disabled:opacity-50"
        >
          {uploading ? t('person.avatar_uploading') : t('person.avatar_upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
        {error && <p className="text-[10px] text-rose">{error}</p>}
      </div>
    </div>
  )
}

export default AvatarUpload
