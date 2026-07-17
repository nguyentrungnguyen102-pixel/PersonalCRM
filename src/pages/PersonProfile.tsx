import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EnrichPanel } from '../components/EnrichPanel'
import { InteractionFormModal } from '../components/InteractionFormModal'
import { LifeEventModal } from '../components/LifeEventModal'
import { MediaAddModal } from '../components/MediaAddModal'
import { GROUP_COLORS } from '../components/PersonCard'
import { PersonFormModal } from '../components/PersonFormModal'
import { RelationsPanel } from '../components/RelationsPanel'
import { TasksPanel } from '../components/TasksPanel'
import { Timeline } from '../components/Timeline'
import type { TimelineItem } from '../components/Timeline'
import { useAuth } from '../hooks/useAuth'
import { usePersonDetail } from '../hooks/usePersonDetail'
import { useLabels, useSettings } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { keepInTouch } from '../lib/keepInTouch'
import {
  buildComputedEvents,
  computedEventSortKeys,
  deleteLifeEvent,
  fetchLifeEvents,
  lifeEventSortKey,
  lifeEventToTimelineItem,
} from '../lib/lifeEvents'
import type { LifeEvent } from '../lib/lifeEvents'
import { formatLunar, nextLunarAnniversary } from '../lib/lunar'
import { supabase } from '../lib/supabase'
import type { Interaction, InteractionType, Media } from '../lib/types'

const INTERACTION_ICONS: Record<InteractionType, string> = {
  gap_mat: '🤝',
  goi_dien: '📞',
  nhan_tin: '💬',
  du_lich: '✈️',
  an_uong: '🍜',
  cong_viec: '💼',
  khac: '📌',
}

const SOCIAL_META: Record<string, { icon: string; label: string }> = {
  facebook: { icon: '📘', label: 'Facebook' },
  zalo: { icon: '💬', label: 'Zalo' },
  linkedin: { icon: '💼', label: 'LinkedIn' },
  instagram: { icon: '📷', label: 'Instagram' },
  tiktok: { icon: '🎵', label: 'TikTok' },
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

// Dinh dang doi tuong Date (khong phai chuoi ISO tu DB) — dung cho ket qua
// tra ve tu nextLunarAnniversary.
function formatDateObj(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Anh xa 1 tuong tac sang TimelineItem — giu nguyen y het markup/du lieu cu
// (icon, nhan loai, ngay, tieu de, ghi chu, dia diem voi tien to 📍) chi khac
// la duoc Timeline.tsx render thay vi JSX lap trong component nay.
function interactionToTimelineItem(item: Interaction, t: (path: string) => string): TimelineItem {
  return {
    id: item.id,
    icon: INTERACTION_ICONS[item.type],
    chipLabel: t(`interaction_types.${item.type}`),
    dateLabel: formatDate(item.date) ?? '',
    title: item.title ?? undefined,
    note: item.note ?? undefined,
    footer: item.location ? `📍 ${item.location}` : undefined,
  }
}

function getYoutubeEmbedId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      return u.pathname.slice(1) || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return v
      const embedMatch = /\/embed\/([^/?]+)/.exec(u.pathname)
      if (embedMatch) return embedMatch[1]
    }
    return null
  } catch {
    return null
  }
}

// Strip tien to emoji khoa (neu co) khoi nhan de tu ghep voi icon rieng,
// tranh lap 2 lan bieu tuong 🔒 trong 1 o khoa.
function stripLeadingLockEmoji(label: string): string {
  return label.replace(/^\s*🔒\s*/, '')
}

interface InfoRowProps {
  label: string
  value: string | null | undefined
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2.5">
      <div className="mb-0.5 text-[9px] tracking-[0.8px] text-muted uppercase">{label}</div>
      <div className="text-xs font-medium text-ink">{value}</div>
    </div>
  )
}

function LockedBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line/70 px-3 py-4 text-center">
      <span className="text-base" aria-hidden>
        🔒
      </span>
      <span className="text-[10px] leading-tight text-muted">{stripLeadingLockEmoji(label)}</span>
    </div>
  )
}

export function PersonProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit, role, user } = useAuth()
  const { t } = useLabels()
  const { warningDays } = useSettings()
  const { person, interactions, media, loading, error, refresh } = usePersonDetail(id)

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Su kien cuoc doi (life_events) — fetch rieng (khong dong bo usePersonDetail
  // theo yeu cau giu hook do nguyen ven), tu refresh qua reloadKey.
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([])
  const [lifeEventsReloadKey, setLifeEventsReloadKey] = useState(0)
  const [showLifeEventModal, setShowLifeEventModal] = useState(false)
  const [editingLifeEvent, setEditingLifeEvent] = useState<LifeEvent | null>(null)
  const [deleteEventTarget, setDeleteEventTarget] = useState<LifeEvent | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [deleteEventError, setDeleteEventError] = useState<string | null>(null)

  function refreshLifeEvents() {
    setLifeEventsReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let active = true
    if (!id) {
      setLifeEvents([])
      return
    }
    fetchLifeEvents(id).then((rows) => {
      if (active) setLifeEvents(rows)
    })
    return () => {
      active = false
    }
  }, [id, lifeEventsReloadKey])

  async function handleDeleteLifeEvent() {
    if (!deleteEventTarget) return
    setDeletingEvent(true)
    setDeleteEventError(null)
    const { error } = await deleteLifeEvent(deleteEventTarget.id)
    setDeletingEvent(false)
    if (error) {
      setDeleteEventError(error.message)
      return
    }
    setDeleteEventTarget(null)
    refreshLifeEvents()
  }

  useEffect(() => {
    let active = true
    const photos = media.filter(
      (m): m is Media & { storage_path: string } => m.type === 'photo' && !!m.storage_path,
    )

    if (photos.length === 0) {
      setSignedUrls({})
      return
    }

    Promise.all(
      photos.map(async (m) => {
        const { data } = await supabase.storage.from('media').createSignedUrl(m.storage_path, 3600)
        return [m.id, data?.signedUrl ?? null] as const
      }),
    ).then((entries) => {
      if (!active) return
      const map: Record<string, string> = {}
      for (const [mediaId, url] of entries) {
        if (url) map[mediaId] = url
      }
      setSignedUrls(map)
    })

    return () => {
      active = false
    }
  }, [media])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="anim-fi flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">{error ?? t('empty.no_persons')}</p>
        <Link
          to="/danh-ba"
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
        >
          ← {t('nav.contacts')}
        </Link>
      </div>
    )
  }

  // Uu tien hien thi ten danh ba (nickname); neu ten day du khac ten danh ba
  // thi hien them dong phu nho phia duoi (thay vi nguoc lai nhu truoc).
  const displayName = personDisplayName(person)
  const showFullNameSubline = !!person.nickname?.trim() && person.full_name !== displayName

  const color = GROUP_COLORS[person.group_type]
  const status = keepInTouch({
    lastContacted: person.last_contacted,
    frequencyDays: person.contact_frequency_days,
    warningDays,
  })
  const lastContactedLabel = formatDate(person.last_contacted)

  const photos = media.filter((m) => m.type === 'photo')
  const videoLinks = media.filter((m) => m.type === 'video_link' && m.external_url)

  const canDeletePerson = role === 'admin' || (role === 'editor' && person.created_by === user?.id)

  async function handleDeletePerson() {
    if (!person) return
    setDeleting(true)
    setDeleteError(null)

    const photoPaths = media
      .filter((m) => m.type === 'photo' && m.storage_path)
      .map((m) => m.storage_path as string)

    if (photoPaths.length > 0) {
      await supabase.storage.from('media').remove(photoPaths)
    }

    const { error: delError } = await supabase.from('persons').delete().eq('id', person.id)

    setDeleting(false)

    if (delError) {
      setDeleteError(delError.message)
      return
    }

    navigate('/danh-ba')
  }

  const preferenceEntries = Object.entries(person.preferences ?? {})
  const socialEntries = Object.entries(person.social_links ?? {})

  const showNotes = canEdit ? !!person.notes : true
  const showGiftIdeas = canEdit ? !!person.gift_ideas : true

  // Gioi/ngay mat/gio — deu hien thi cho moi vai tro (khong phai du lieu
  // rieng tu, di qua persons_safe cho viewer).
  const genderLabel =
    person.gender === 'nam' ? t('person.gender_nam') : person.gender === 'nu' ? t('person.gender_nu') : null

  const hasLunarPair = person.death_lunar_day != null && person.death_lunar_month != null
  const lunarLabel = hasLunarPair
    ? `${formatLunar(person.death_lunar_day as number, person.death_lunar_month as number)} ${t('person.lunar_suffix')}`
    : null

  const deathDateBase = formatDate(person.death_date)
  const deathDateValue = deathDateBase && lunarLabel ? `${deathDateBase} (${lunarLabel})` : deathDateBase

  const nextAnniversaryValue =
    hasLunarPair && lunarLabel
      ? `${lunarLabel} — ${formatDateObj(
          nextLunarAnniversary(
            person.death_lunar_day as number,
            person.death_lunar_month as number,
            new Date(),
          ),
        )}`
      : null

  // Dong thoi gian gop: tuong tac (nhu cu) + su kien cuoc doi (life_events) +
  // su kien "ao" tinh tu ho so (sinh/mat) — sap xep chung moi -> cu theo 1
  // sort key thong nhat (xem lifeEventSortKey/computedEventSortKeys).
  function canDeleteLifeEvent(e: LifeEvent): boolean {
    return role === 'admin' || (role === 'editor' && e.created_by === user?.id)
  }

  function lifeEventActions(e: LifeEvent) {
    if (!canEdit) return undefined
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setEditingLifeEvent(e)
            setShowLifeEventModal(true)
          }}
          aria-label={t('actions.edit')}
          className="rounded-md p-0.5 text-muted transition-colors hover:text-ink"
        >
          ✎
        </button>
        {canDeleteLifeEvent(e) && (
          <button
            type="button"
            onClick={() => setDeleteEventTarget(e)}
            aria-label={t('actions.delete')}
            className="rounded-md p-0.5 text-muted transition-colors hover:text-rose"
          >
            ✕
          </button>
        )}
      </>
    )
  }

  const computedItems = buildComputedEvents(person, t)
  const computedKeys = computedEventSortKeys(person)

  const timelineEntries: { sortKey: string; item: TimelineItem }[] = [
    ...interactions.map((i) => ({ sortKey: i.date, item: interactionToTimelineItem(i, t) })),
    ...lifeEvents.map((e) => ({
      sortKey: lifeEventSortKey(e),
      item: lifeEventToTimelineItem(e, t, lifeEventActions(e)),
    })),
    ...computedItems.map((item) => ({ sortKey: computedKeys[item.id] ?? '', item })),
  ]
  timelineEntries.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))
  const timelineItems = timelineEntries.map((e) => e.item)

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      {/* Header */}
      <div
        className="relative mb-4 overflow-hidden rounded-2xl border p-5"
        style={{
          borderColor: `${color}30`,
          background: `linear-gradient(135deg, ${color}18, rgba(249,115,22,0.04) 60%, transparent)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-10 h-[150px] w-[150px] rounded-full"
          style={{ background: `radial-gradient(circle, ${color}18, transparent 70%)` }}
        />
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={displayName} avatarUrl={person.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight text-ink">
                {displayName}
              </h1>
              {person.is_favorite && <span aria-hidden>⭐</span>}
            </div>
            {showFullNameSubline && <p className="mt-0.5 text-xs text-muted">{person.full_name}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: `${color}18`, color, borderColor: `${color}40` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
                {t(`groups.${person.group_type}`)}
              </span>
              {person.in_family_tree && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {t('person.in_family_tree')}
                </span>
              )}
              {person.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                {t('actions.edit')}
              </button>
              {canDeletePerson && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-rose/30 px-3 py-1.5 text-xs font-medium text-rose transition-colors hover:bg-rose/10"
                >
                  {t('actions.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr_260px]">
        {/* Cot trai — Thong tin */}
        <aside className="order-3 flex flex-col gap-2 md:order-none">
          <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
            {t('person.info')}
          </div>
          <InfoRow label={t('person.phone')} value={person.phone} />
          <InfoRow label={t('person.email')} value={person.email} />
          <InfoRow label={t('person.birthday')} value={formatDate(person.birthday)} />
          <InfoRow label={t('person.company')} value={person.company} />
          <InfoRow label={t('person.job_title')} value={person.job_title} />
          <InfoRow label={t('person.address')} value={person.address} />
          <InfoRow label={t('person.hometown')} value={person.hometown} />
          <InfoRow label={t('person.gender')} value={genderLabel} />
          <InfoRow label={t('person.death_date')} value={deathDateValue} />
          <InfoRow label={t('person.death_lunar')} value={nextAnniversaryValue} />
          <InfoRow label={t('person.burial_place')} value={person.burial_place} />
          <InfoRow label={t('person.how_we_met')} value={person.how_we_met} />

          {person.hobbies.length > 0 && (
            <div className="rounded-lg border border-line bg-card px-3 py-2.5">
              <div className="mb-1.5 text-[9px] tracking-[0.8px] text-muted uppercase">
                {t('person.hobbies')}
              </div>
              <div className="flex flex-wrap gap-1">
                {person.hobbies.map((hobby) => (
                  <span
                    key={hobby}
                    className="rounded-full border border-line bg-bg/40 px-2 py-0.5 text-[10px] text-ink"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}

          {preferenceEntries.length > 0 && (
            <div className="rounded-lg border border-amber/15 bg-amber/5 px-3 py-2.5">
              <div className="mb-1.5 text-[9px] font-semibold tracking-[0.8px] text-amber uppercase">
                {t('person.preferences')}
              </div>
              <div className="flex flex-col gap-1">
                {preferenceEntries.map(([key, value]) => (
                  <div key={key} className="flex gap-1.5 text-[11px]">
                    <span className="text-muted">{key}:</span>
                    <span className="text-ink">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {person.biography && (
            <div className="rounded-lg border border-line bg-card px-3 py-2.5">
              <div className="mb-1.5 text-[9px] tracking-[0.8px] text-muted uppercase">
                {t('person.biography')}
              </div>
              <div className="text-[11px] leading-relaxed text-ink">{person.biography}</div>
            </div>
          )}
        </aside>

        {/* Cot giua — Dong thoi gian + Gallery */}
        <section className="order-2 flex flex-col gap-6 md:order-none">
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('person.timeline')}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowInteractionModal(true)}
                    className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                  >
                    + {t('actions.add_interaction')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLifeEvent(null)
                      setShowLifeEventModal(true)
                    }}
                    className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                  >
                    + {t('life_event.add')}
                  </button>
                </div>
              )}
            </div>

            {timelineItems.length === 0 && (
              <p className="text-xs text-muted">{t('empty.no_interactions')}</p>
            )}

            {timelineItems.length > 0 && <Timeline items={timelineItems} />}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('person.gallery')}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowMediaModal(true)}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  + {t('person.gallery')}
                </button>
              )}
            </div>

            {photos.length === 0 && videoLinks.length === 0 && (
              <p className="text-xs text-muted">{t('empty.no_media')}</p>
            )}

            {photos.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((item) => {
                  const url = signedUrls[item.id]
                  return (
                    <a
                      key={item.id}
                      href={url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block aspect-square overflow-hidden rounded-lg border border-line bg-bg/40"
                      onClick={(e) => {
                        if (!url) e.preventDefault()
                      }}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={item.caption ?? ''}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg">📷</div>
                      )}
                    </a>
                  )
                })}
              </div>
            )}

            {videoLinks.map((item) => {
              const url = item.external_url as string
              const embedId = getYoutubeEmbedId(url)
              if (embedId) {
                return (
                  <div key={item.id} className="mb-2.5 overflow-hidden rounded-lg border border-line">
                    <div className="aspect-video w-full">
                      <iframe
                        src={`https://www.youtube.com/embed/${embedId}`}
                        title={item.caption ?? 'video'}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    {item.caption && (
                      <div className="px-2.5 py-1.5 text-[11px] text-muted">{item.caption}</div>
                    )}
                  </div>
                )
              }
              let host = url
              try {
                host = new URL(url).hostname.replace(/^www\./, '')
              } catch {
                // giu nguyen url goc neu khong parse duoc
              }
              return (
                <a
                  key={item.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 flex items-center gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2"
                >
                  <span className="flex-shrink-0 text-lg" aria-hidden>
                    🎬
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink">
                      {item.caption ?? host}
                    </div>
                    <div className="text-[10px] text-muted">{host}</div>
                  </div>
                  <span className="flex-shrink-0 text-primary" aria-hidden>
                    ↗
                  </span>
                </a>
              )
            })}
          </div>
        </section>

        {/* Cot phai — Quick info */}
        <aside className="order-1 flex flex-col gap-3 md:order-none">
          <div className="rounded-lg border border-line bg-card px-3 py-3">
            <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
              {t('person.keep_in_touch')}
            </div>
            <Badge result={status} className="mb-2" />
            <div className="text-[11px] text-muted">
              {t('person.last_contact')}:{' '}
              <span className="text-ink">{lastContactedLabel ?? t('person.no_contact_yet')}</span>
            </div>
            {person.contact_frequency_days != null && (
              <div className="mt-0.5 font-mono text-[11px] text-muted">
                {person.contact_frequency_days}
              </div>
            )}
          </div>

          <RelationsPanel personId={person.id} personName={displayName} />

          <TasksPanel personId={person.id} />

          {canEdit && <EnrichPanel person={person} onSaved={refresh} />}

          {socialEntries.length > 0 && (
            <div className="rounded-lg border border-line bg-card px-3 py-3">
              <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('person.social')}
              </div>
              <div className="flex flex-col gap-1.5">
                {socialEntries.map(([key, value]) => {
                  const meta = SOCIAL_META[key] ?? { icon: '🔗', label: key }
                  if (!value) return null
                  return (
                    <a
                      key={key}
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 truncate text-[11px] text-primary hover:underline"
                    >
                      <span aria-hidden>{meta.icon}</span>
                      <span className="truncate">{meta.label}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {showNotes && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-3">
              <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-primary uppercase">
                {t('person.notes')}
              </div>
              {canEdit ? (
                <div className="text-[11px] leading-relaxed text-ink">{person.notes}</div>
              ) : (
                <LockedBox label={t('person.locked_field')} />
              )}
            </div>
          )}

          {showGiftIdeas && (
            <div className="rounded-lg border border-rose/15 bg-rose/5 px-3 py-3">
              <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-rose uppercase">
                {t('person.gift_ideas')}
              </div>
              {canEdit ? (
                <div className="text-[11px] leading-relaxed text-ink">{person.gift_ideas}</div>
              ) : (
                <LockedBox label={t('person.locked_field')} />
              )}
            </div>
          )}
        </aside>
      </div>

      <PersonFormModal
        open={showEditModal}
        person={person}
        onClose={() => setShowEditModal(false)}
        onSaved={refresh}
      />

      <InteractionFormModal
        open={showInteractionModal}
        personId={person.id}
        onClose={() => setShowInteractionModal(false)}
        onSaved={refresh}
      />

      <MediaAddModal
        open={showMediaModal}
        personId={person.id}
        onClose={() => setShowMediaModal(false)}
        onSaved={refresh}
      />

      <LifeEventModal
        open={showLifeEventModal}
        personId={person.id}
        event={editingLifeEvent}
        onClose={() => {
          setShowLifeEventModal(false)
          setEditingLifeEvent(null)
        }}
        onSaved={refreshLifeEvents}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        loading={deleting}
        error={deleteError}
        onConfirm={() => void handleDeletePerson()}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setDeleteError(null)
        }}
      />

      <ConfirmDialog
        open={!!deleteEventTarget}
        loading={deletingEvent}
        error={deleteEventError}
        message={t('life_event.delete_confirm')}
        onConfirm={() => void handleDeleteLifeEvent()}
        onCancel={() => {
          setDeleteEventTarget(null)
          setDeleteEventError(null)
        }}
      />
    </div>
  )
}

export default PersonProfile
