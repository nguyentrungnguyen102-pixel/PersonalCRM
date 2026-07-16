// Trang "Gia pha" (/gia-pha) — cay gia pha co mau theo "phia" (chong/vo/con
// chung), danh sach thanh vien dong ho theo doi, va giay nhac giO sap toi.
// Chi nguoi co in_family_tree = true moi xuat hien o day; xem
// src/lib/familyLayout.ts (layoutFamilyTree/computeFamilySides) va
// src/lib/lunar.ts (nextLunarAnniversary/formatLunar/daysUntil) cho logic
// tinh toan thuan. Viewer (!canEdit) thay giao dien y het, chi an nut
// them/xoa — RLS + persons_safe da lo phan du lieu rieng tu qua usePersons().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FamilyTreeSvg } from '../components/diagram/FamilyTreeSvg'
import { FAMILY_SIDE_COLORS } from '../components/diagram/treeDisplay'
import { usePanZoom } from '../components/diagram/usePanZoom'
import { FamilyMemberPicker } from '../components/giapha/FamilyMemberPicker'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { computeFamilySides, FAMILY_RELATION_TYPES, layoutFamilyTree, NODE_W } from '../lib/familyLayout'
import type { FamilyLayoutNode, FamilySide } from '../lib/familyLayout'
import { daysUntil, formatLunar, nextLunarAnniversary } from '../lib/lunar'
import { vnNormalize } from '../lib/normalize'
import type { RelationshipRow } from '../lib/relations'
import { supabase } from '../lib/supabase'
import { exportSvgToPng } from '../lib/svgExport'

const ROOT_KEY = 'personalcrm.giapha.root'
const GIO_WITHIN_DAYS = 60
const GIO_WARN_DAYS = 30
// Phai khop cardH (58) khai bao trong FamilyTreeSvg.tsx — dung de tinh
// kich thuoc svg xuat/in bao trum toan bo cay (xem treeExportSize duoi day).
const EXPORT_CARD_H = 58
const EXPORT_PADDING = 32

function loadStoredRoot(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ROOT_KEY)
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null
  const match = /^(\d{4})-/.exec(dateStr)
  return match ? Number(match[1]) : null
}

// "1932–2001" — chi hien nhung gia tri co (xem 2c trong ke hoach).
function lifespanLabel(p: PersonWithMeta): string | null {
  const birth = yearOf(p.birthday)
  const death = yearOf(p.death_date)
  if (birth && death) return `${birth}–${death}`
  if (birth) return `${birth}`
  if (death) return `${death}`
  return null
}

interface LegendChipProps {
  color: string
  label: string
}

function LegendChip({ color, label }: LegendChipProps) {
  return (
    <span
      style={{ borderColor: `${color}40`, background: `${color}15`, color }}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

interface MemberRowProps {
  person: PersonWithMeta
  canEdit: boolean
  onOpen: () => void
  onRemove: () => void
}

function MemberRow({ person, canEdit, onOpen, onRemove }: MemberRowProps) {
  const { t } = useLabels()
  const lifespan = lifespanLabel(person)
  const hasLunar = person.death_lunar_day != null && person.death_lunar_month != null
  const lunarLabel = hasLunar
    ? `${formatLunar(person.death_lunar_day as number, person.death_lunar_month as number)} ${t('person.lunar_suffix')}`
    : null

  return (
    <div className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-bg/60">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Avatar name={personDisplayName(person)} avatarUrl={person.avatar_url} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink">{personDisplayName(person)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {lifespan && <span className="font-mono text-[10px] text-muted">{lifespan}</span>}
            {lunarLabel && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                {lunarLabel}
              </span>
            )}
          </div>
        </div>
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('giapha.remove_member')}
          className="flex-shrink-0 rounded-md p-1 text-muted transition-colors hover:text-rose"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function GiaPha() {
  const { t } = useLabels()
  const { canEdit } = useAuth()
  const navigate = useNavigate()

  const { persons, loading: personsLoading, refresh } = usePersons()
  const [relationships, setRelationships] = useState<RelationshipRow[]>([])
  const [relLoading, setRelLoading] = useState(true)

  const [rootId, setRootId] = useState<string | null>(loadStoredRoot)
  const [rootQuery, setRootQuery] = useState('')
  const [showRootPicker, setShowRootPicker] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showAllGio, setShowAllGio] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<PersonWithMeta | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const [exportError, setExportError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const exportSvgRef = useRef<SVGSVGElement>(null)

  const panZoom = usePanZoom(`tree:${rootId}`)

  useEffect(() => {
    let active = true
    setRelLoading(true)
    supabase
      .from('relationships')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setRelationships(data as RelationshipRow[])
        setRelLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const familyPersons = useMemo(() => persons.filter((p) => p.in_family_tree), [persons])
  const familyIds = useMemo(() => new Set(familyPersons.map((p) => p.id)), [familyPersons])
  const familyPersonById = useMemo(() => {
    const map = new Map<string, PersonWithMeta>()
    for (const p of familyPersons) map.set(p.id, p)
    return map
  }, [familyPersons])

  // Mac dinh chon nguoi co nhieu quan he GIA DINH nhat lam goc cay (cung
  // heuristic voi Diagram.tsx) — chi tinh lai khi rootId hien tai khong hop
  // le (null hoac khong con thuoc dong ho, vi du sau khi bi bo khoi cay).
  useEffect(() => {
    if (familyPersons.length === 0) return
    if (rootId && familyIds.has(rootId)) return
    const counts = new Map<string, number>()
    for (const r of relationships) {
      if (!FAMILY_RELATION_TYPES.has(r.relation_type)) continue
      counts.set(r.person_a, (counts.get(r.person_a) ?? 0) + 1)
      counts.set(r.person_b, (counts.get(r.person_b) ?? 0) + 1)
    }
    let best: string | null = null
    let bestCount = -1
    for (const p of familyPersons) {
      const c = counts.get(p.id) ?? 0
      if (c > bestCount) {
        bestCount = c
        best = p.id
      }
    }
    setRootId(best)
  }, [familyPersons, familyIds, relationships, rootId])

  useEffect(() => {
    if (!rootId) return
    try {
      window.localStorage.setItem(ROOT_KEY, rootId)
    } catch {
      // localStorage khong kha dung — bo qua im lang
    }
  }, [rootId])

  // Cap vo chong goc: root + nguoi vo_chong DAU TIEN cung thuoc dong ho.
  const rootPartnerId = useMemo(() => {
    if (!rootId) return null
    const rel = relationships.find(
      (r) =>
        r.relation_type === 'vo_chong' &&
        ((r.person_a === rootId && familyIds.has(r.person_b)) ||
          (r.person_b === rootId && familyIds.has(r.person_a))),
    )
    if (!rel) return null
    return rel.person_a === rootId ? rel.person_b : rel.person_a
  }, [rootId, relationships, familyIds])

  const rootPerson = rootId ? (familyPersonById.get(rootId) ?? null) : null
  const partnerPerson = rootPartnerId ? (familyPersonById.get(rootPartnerId) ?? null) : null
  const bothGenderKnown = !!rootPerson?.gender && !!partnerPerson?.gender
  // Chong (nam) luon la A / vo (nu) la B khi biet ca 2 gioi tinh; khong ro
  // thi giu nguyen root = A, partner = B (xem ke hoach 2c).
  const swapForGender = bothGenderKnown && rootPerson?.gender === 'nu' && partnerPerson?.gender === 'nam'
  const rootAId = swapForGender ? rootPartnerId : rootId
  const rootBId = swapForGender ? rootId : rootPartnerId

  const familyGenderOf = useCallback(
    (id: string) => familyPersonById.get(id)?.gender ?? null,
    [familyPersonById],
  )

  const tree = useMemo(
    () =>
      rootAId
        ? layoutFamilyTree(relationships, familyIds, rootAId, { genderOf: familyGenderOf })
        : { nodes: [], edges: [] },
    [relationships, familyIds, rootAId, familyGenderOf],
  )

  const sideOf = useMemo(
    () =>
      rootAId
        ? computeFamilySides(relationships, familyIds, rootAId, rootBId)
        : new Map<string, FamilySide>(),
    [relationships, familyIds, rootAId, rootBId],
  )

  const treeNodeById = useMemo(() => {
    const map = new Map<string, FamilyLayoutNode>()
    for (const n of tree.nodes) map.set(n.id, n)
    return map
  }, [tree.nodes])

  const deceasedIds = useMemo(() => {
    const set = new Set<string>()
    for (const p of familyPersons) {
      if (p.death_date || (p.death_lunar_day != null && p.death_lunar_month != null)) set.add(p.id)
    }
    return set
  }, [familyPersons])

  const rootCandidates = useMemo(() => {
    const q = vnNormalize(rootQuery.trim())
    const list = q
      ? familyPersons.filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
      : familyPersons
    return list.slice(0, 8)
  }, [familyPersons, rootQuery])

  const rootButtonLabel = useMemo(() => {
    if (!rootId) return '—'
    const rp = familyPersonById.get(rootId)
    if (!rp) return '—'
    const name = personDisplayName(rp)
    if (!rootPartnerId) return name
    const pp = familyPersonById.get(rootPartnerId)
    return pp ? `${name} & ${personDisplayName(pp)}` : name
  }, [rootId, rootPartnerId, familyPersonById])

  const personAtA = rootAId ? (familyPersonById.get(rootAId) ?? null) : null
  const personAtB = rootBId ? (familyPersonById.get(rootBId) ?? null) : null

  const sideLabelA = rootAId
    ? rootBId && bothGenderKnown
      ? t('giapha.side_chong')
      : personAtA
        ? `${t('giapha.side_prefix')} ${personDisplayName(personAtA)}`
        : ''
    : ''

  const sideLabelB = rootBId
    ? bothGenderKnown
      ? t('giapha.side_vo')
      : personAtB
        ? `${t('giapha.side_prefix')} ${personDisplayName(personAtB)}`
        : ''
    : null

  const hasChungSide = useMemo(() => Array.from(sideOf.values()).includes('chung'), [sideOf])

  // --- Thanh vien theo doi (nhom tu ket qua layout cay) --------------------
  const generationGroups = useMemo(() => {
    const byGen = new Map<number, { person: PersonWithMeta; x: number }[]>()
    for (const node of tree.nodes) {
      const p = familyPersonById.get(node.id)
      if (!p) continue
      const arr = byGen.get(node.gen) ?? []
      arr.push({ person: p, x: node.x })
      byGen.set(node.gen, arr)
    }
    return Array.from(byGen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([gen, list]) => ({
        gen,
        persons: list.sort((a, b) => a.x - b.x).map((x) => x.person),
      }))
  }, [tree.nodes, familyPersonById])

  const unlinkedMembers = useMemo(() => {
    const treeIds = new Set(tree.nodes.map((n) => n.id))
    return familyPersons.filter((p) => !treeIds.has(p.id))
  }, [familyPersons, tree.nodes])

  // --- Gio sap toi -----------------------------------------------------------
  const upcomingGio = useMemo(() => {
    const now = new Date()
    return familyPersons
      .filter((p) => p.death_lunar_day != null && p.death_lunar_month != null)
      .map((p) => {
        const nextDate = nextLunarAnniversary(p.death_lunar_day as number, p.death_lunar_month as number, now)
        return { person: p, days: daysUntil(nextDate, now) }
      })
      .sort((a, b) => a.days - b.days)
  }, [familyPersons])

  const withinRangeGio = useMemo(
    () => upcomingGio.filter((x) => x.days <= GIO_WITHIN_DAYS),
    [upcomingGio],
  )
  const visibleGio = showAllGio ? upcomingGio : withinRangeGio
  const hasMoreGio = upcomingGio.length > withinRangeGio.length

  // --- Xuat anh PNG / In ------------------------------------------------------
  // Dung chung cho ca svg xuat (offscreen) va svg in (hien khi printing) —
  // xem src/components/diagram/FamilyTreeSvg.tsx (prop yearsOf, chi dung o
  // printMode).
  const yearsOf = useCallback(
    (id: string) => {
      const p = familyPersonById.get(id)
      return p ? lifespanLabel(p) : null
    },
    [familyPersonById],
  )

  // Kich thuoc svg xuat/in — bao trum toan bo cay theo toa do node (tu
  // src/lib/familyLayout.ts layoutFamilyTree, da co san le NODE_W/2 o dau).
  const treeExportSize = useMemo(() => {
    if (tree.nodes.length === 0) return { width: 0, height: 0 }
    const maxX = Math.max(...tree.nodes.map((n) => n.x))
    const maxY = Math.max(...tree.nodes.map((n) => n.y))
    return {
      width: maxX + NODE_W + EXPORT_PADDING,
      height: maxY + EXPORT_CARD_H + EXPORT_PADDING,
    }
  }, [tree.nodes])

  async function handleExportPng() {
    setExportError(null)
    try {
      if (!exportSvgRef.current) throw new Error('Khong tim thay cay de xuat.')
      await exportSvgToPng(exportSvgRef.current, 'gia-pha.png')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    }
  }

  function handlePrint() {
    setExportError(null)
    setPrinting(true)
  }

  // Cho DOM commit xong svg.print-tree (mount khi printing=true) roi moi mo
  // hop thoai in — goi truc tiep se in truoc khi trinh duyet ve xong node.
  useEffect(() => {
    if (!printing) return
    const raf = requestAnimationFrame(() => window.print())
    return () => cancelAnimationFrame(raf)
  }, [printing])

  // Dong hop thoai in (Huy hoac In xong) → thao svg.print-tree khoi DOM.
  useEffect(() => {
    function handleAfterPrint() {
      setPrinting(false)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  function chooseRoot(id: string) {
    setRootId(id)
    setShowRootPicker(false)
    setRootQuery('')
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError(null)
    const { error } = await supabase
      .from('persons')
      .update({ in_family_tree: false })
      .eq('id', removeTarget.id)
    setRemoving(false)
    if (error) {
      setRemoveError(error.message)
      return
    }
    setRemoveTarget(null)
    refresh()
  }

  const loading = personsLoading || relLoading

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">{t('giapha.title')}</h1>
          <p className="mt-0.5 text-xs text-muted">
            {familyPersons.length} {t('giapha.members')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {familyPersons.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRootPicker((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink"
              >
                <span className="text-muted">{t('giapha.root_couple')}:</span>
                <span className="max-w-[160px] truncate font-semibold">{rootButtonLabel}</span>
              </button>
              {showRootPicker && (
                <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-line bg-surface p-2 shadow-lg">
                  <input
                    autoFocus
                    value={rootQuery}
                    onChange={(e) => setRootQuery(e.target.value)}
                    placeholder={t('actions.search')}
                    className="mb-2 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
                  />
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {rootCandidates.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => chooseRoot(p.id)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          p.id === rootId ? 'bg-primary/10' : 'hover:bg-bg/60'
                        }`}
                      >
                        <Avatar name={personDisplayName(p)} avatarUrl={p.avatar_url} size={22} />
                        <span className="truncate text-xs text-ink">{personDisplayName(p)}</span>
                      </button>
                    ))}
                    {rootCandidates.length === 0 && (
                      <p className="py-2 text-center text-xs text-muted">{t('empty.no_results')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
            >
              + {t('giapha.add_members')}
            </button>
          )}
        </div>
      </div>

      {familyPersons.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-card border border-line bg-card px-6 text-center">
          <p className="text-sm text-muted">{t('giapha.empty')}</p>
        </div>
      )}

      {familyPersons.length > 0 && (
        <>
          {/* Cay gia pha */}
          <div className="mb-4 rounded-card border border-line bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-heading text-sm font-semibold text-ink">{t('giapha.tree')}</div>
              {tree.nodes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleExportPng()}
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[10px] font-medium text-ink transition-colors hover:border-primary/30"
                  >
                    {t('giapha.export_png')}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[10px] font-medium text-ink transition-colors hover:border-primary/30"
                  >
                    {t('giapha.print')}
                  </button>
                </div>
              )}
            </div>

            {exportError && (
              <p className="mb-2 rounded-lg border border-rose/30 bg-rose/5 px-2.5 py-1.5 text-[10px] text-rose">
                {exportError}
              </p>
            )}

            <div className="relative h-[70vh] overflow-hidden rounded-lg border border-line bg-bg/20">
              <svg
                width="100%"
                height="100%"
                onPointerDown={panZoom.onPointerDown}
                onPointerMove={panZoom.onPointerMove}
                onPointerUp={panZoom.onPointerUp}
                onWheel={panZoom.onWheel}
                className="cursor-grab touch-none active:cursor-grabbing"
              >
                <g transform={`translate(${panZoom.view.x},${panZoom.view.y}) scale(${panZoom.view.scale})`}>
                  <FamilyTreeSvg
                    nodes={tree.nodes}
                    edges={tree.edges}
                    treeNodeById={treeNodeById}
                    personById={familyPersonById}
                    sideOf={sideOf}
                    deceasedIds={deceasedIds}
                    onSelectPerson={(id) => navigate(`/nguoi/${id}`)}
                  />
                </g>
              </svg>

              {rootAId && tree.nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
                  <p className="text-sm text-muted">{t('diagram.empty_family')}</p>
                </div>
              )}

              <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-label={t('diagram.zoom_in')}
                  onClick={() => panZoom.zoomBy(1.25)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-base font-bold text-ink shadow"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={t('diagram.zoom_out')}
                  onClick={() => panZoom.zoomBy(0.8)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-base font-bold text-ink shadow"
                >
                  −
                </button>
              </div>
            </div>

            {tree.nodes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sideLabelA && <LegendChip color={FAMILY_SIDE_COLORS.a} label={sideLabelA} />}
                {rootBId && sideLabelB && <LegendChip color={FAMILY_SIDE_COLORS.b} label={sideLabelB} />}
                {hasChungSide && <LegendChip color={FAMILY_SIDE_COLORS.chung} label={t('giapha.side_chung')} />}
              </div>
            )}
          </div>

          {/* Ban sao cay o che do printMode, dat ngoai man hinh — chi de
              exportSvgToPng() doc va serialize (xem src/lib/svgExport.ts).
              Khong dung pan/zoom, khong an bang display:none (canvas khong
              rasterize duoc phan tu display:none/khong render). */}
          <svg
            ref={exportSvgRef}
            width={treeExportSize.width}
            height={treeExportSize.height}
            viewBox={`0 0 ${treeExportSize.width} ${treeExportSize.height}`}
            aria-hidden="true"
            style={{ position: 'fixed', left: -99999, top: 0 }}
          >
            <FamilyTreeSvg
              printMode
              nodes={tree.nodes}
              edges={tree.edges}
              treeNodeById={treeNodeById}
              personById={familyPersonById}
              sideOf={sideOf}
              deceasedIds={deceasedIds}
              yearsOf={yearsOf}
            />
          </svg>

          {/* Ban sao cay hien khi in (window.print(), xem handlePrint) — chi
              subtree nay hien tren trang in, xem @media print o src/index.css. */}
          {printing && (
            <div className="print-tree">
              <svg width="100%" viewBox={`0 0 ${treeExportSize.width} ${treeExportSize.height}`}>
                <rect x={0} y={0} width={treeExportSize.width} height={treeExportSize.height} fill="#080407" />
                <FamilyTreeSvg
                  printMode
                  nodes={tree.nodes}
                  edges={tree.edges}
                  treeNodeById={treeNodeById}
                  personById={familyPersonById}
                  sideOf={sideOf}
                  deceasedIds={deceasedIds}
                  yearsOf={yearsOf}
                />
              </svg>
            </div>
          )}

          {/* Thanh vien theo doi */}
          <div className="mb-4 rounded-card border border-line bg-card p-4">
            <div className="mb-3 font-heading text-sm font-semibold text-ink">{t('giapha.members')}</div>

            {generationGroups.map(({ gen, persons: genPersons }) => (
              <div key={gen} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                  {t('giapha.generation')} {gen + 1}
                </div>
                <div className="flex flex-col gap-1">
                  {genPersons.map((p) => (
                    <MemberRow
                      key={p.id}
                      person={p}
                      canEdit={canEdit}
                      onOpen={() => navigate(`/nguoi/${p.id}`)}
                      onRemove={() => setRemoveTarget(p)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {unlinkedMembers.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                  {t('giapha.unlinked')}
                </div>
                <p className="mb-1.5 text-[10px] text-muted">{t('giapha.unlinked_hint')}</p>
                <div className="flex flex-col gap-1">
                  {unlinkedMembers.map((p) => (
                    <MemberRow
                      key={p.id}
                      person={p}
                      canEdit={canEdit}
                      onOpen={() => navigate(`/nguoi/${p.id}`)}
                      onRemove={() => setRemoveTarget(p)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gio sap toi */}
          <div className="rounded-card border border-line bg-card p-4">
            <div className="mb-3 font-heading text-sm font-semibold text-ink">{t('giapha.upcoming_gio')}</div>

            {upcomingGio.length === 0 && <p className="text-xs text-muted">{t('giapha.no_gio')}</p>}

            {upcomingGio.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {visibleGio.map(({ person, days }) => {
                  const warn = days <= GIO_WARN_DAYS
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => navigate(`/nguoi/${person.id}`)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                        warn ? 'border-amber/30 bg-amber/5' : 'border-line bg-card hover:border-primary/20'
                      }`}
                    >
                      <Avatar name={personDisplayName(person)} avatarUrl={person.avatar_url} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-ink">{personDisplayName(person)}</div>
                        <div className="mt-0.5 text-[10px] text-muted">
                          {formatLunar(person.death_lunar_day as number, person.death_lunar_month as number)}{' '}
                          {t('person.lunar_suffix')}
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 font-mono text-[10px] font-semibold ${
                          warn ? 'text-amber' : 'text-muted'
                        }`}
                      >
                        {t('giapha.days_left')} {days} {t('giapha.days_unit')}
                      </span>
                    </button>
                  )
                })}
                {hasMoreGio && !showAllGio && (
                  <button
                    type="button"
                    onClick={() => setShowAllGio(true)}
                    className="self-start text-[10px] font-medium text-primary hover:opacity-80"
                  >
                    {t('giapha.show_all')}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {canEdit && (
        <FamilyMemberPicker
          open={showPicker}
          onClose={() => setShowPicker(false)}
          persons={persons}
          onChanged={refresh}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        loading={removing}
        error={removeError}
        title={t('giapha.remove_member')}
        message={t('giapha.remove_confirm')}
        confirmLabel={t('giapha.remove_member')}
        tone="default"
        onConfirm={() => void handleConfirmRemove()}
        onCancel={() => {
          setRemoveTarget(null)
          setRemoveError(null)
        }}
      />
    </div>
  )
}

export default GiaPha
