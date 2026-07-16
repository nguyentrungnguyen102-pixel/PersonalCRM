// Trang "So do quan he" (/so-do) — 2 che do xem (khong sua): Mang luoi (d3
// force-directed, moi loai quan he) va Cay gia pha (chi quan he gia dinh,
// xem src/lib/familyLayout.ts). Chi doc du lieu — khong co nut them/sua/xoa
// o day, dung profile tung nguoi (RelationsPanel) de quan ly quan he.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { Avatar } from '../components/Avatar'
import { FamilyTreeSvg } from '../components/diagram/FamilyTreeSvg'
import { initialsOf, truncateName } from '../components/diagram/treeDisplay'
import { useElementSize, usePanZoom } from '../components/diagram/usePanZoom'
import { GROUP_COLORS } from '../components/PersonCard'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { FAMILY_RELATION_TYPES, layoutFamilyTree } from '../lib/familyLayout'
import type { FamilyLayoutNode } from '../lib/familyLayout'
import { vnNormalize } from '../lib/normalize'
import type { RelationType, RelationshipRow } from '../lib/relations'
import { fetchRelationTypes } from '../lib/relations'
import { supabase } from '../lib/supabase'
import type { GroupType } from '../lib/types'

const MODE_KEY = 'personalcrm.diagram.mode'
const NETWORK_TICKS = 300
const ZOOM_LABEL_THRESHOLD = 0.8

type Mode = 'network' | 'tree'

function loadMode(): Mode {
  if (typeof window === 'undefined') return 'network'
  return window.localStorage.getItem(MODE_KEY) === 'tree' ? 'tree' : 'network'
}

interface DiagramPerson {
  id: string
  nickname: string | null
  full_name: string
  avatar_url: string | null
  group_type: GroupType
}

// Nhan hien thi quan he dua tren goc nhin cua `personId` — cung quy uoc
// chieu duoc tai lieu hoa trong src/lib/relations.ts (K = nguoi kia, P =
// personId): neu personId dung vi tri person_a thi doc nhan b_to_a, nguoc
// lai doc a_to_b. Viet lai tai cho (khong sua relations.ts) vi o day da co
// san toan bo relationships trong bo nho, goi lai fetchRelationships se query
// mang mot lan nua cho moi cai click.
function labelForPerspective(r: RelationshipRow, personId: string): string {
  return r.person_a === personId ? r.direction_label_b_to_a : r.direction_label_a_to_b
}

// --- Che do Mang luoi (d3-force) -------------------------------------------

interface SimNode extends SimulationNodeDatum {
  id: string
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  relationType: string
}

interface NetworkLayout {
  positions: Map<string, { x: number; y: number }>
  links: { source: string; target: string; relationType: string }[]
}

function buildNetworkLayout(
  nodeIds: string[],
  rels: RelationshipRow[],
  width: number,
  height: number,
): NetworkLayout {
  if (nodeIds.length === 0) return { positions: new Map(), links: [] }

  const simNodes: SimNode[] = nodeIds.map((id) => ({ id }))
  const simLinks: SimLink[] = rels.map((r) => ({
    source: r.person_a,
    target: r.person_b,
    relationType: r.relation_type,
  }))

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(110),
    )
    .force('charge', forceManyBody().strength(-220))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(34))
    .stop()

  // Chay san N tick roi dung han (khong dung timer/on('tick')) — layout
  // tinh (static), do CPU khong ton khi nguoi dung tuong tac (pan/zoom/click).
  for (let i = 0; i < NETWORK_TICKS; i++) simulation.tick()

  const positions = new Map<string, { x: number; y: number }>()
  for (const n of simNodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })

  const links = simLinks.map((l) => {
    const source = typeof l.source === 'object' ? (l.source as SimNode).id : (l.source as string)
    const target = typeof l.target === 'object' ? (l.target as SimNode).id : (l.target as string)
    return { source, target, relationType: l.relationType }
  })

  return { positions, links }
}

export function Diagram() {
  const { t } = useLabels()
  const { canEdit } = useAuth()
  const navigate = useNavigate()

  const [persons, setPersons] = useState<DiagramPerson[]>([])
  const [relationships, setRelationships] = useState<RelationshipRow[]>([])
  const [relationTypes, setRelationTypes] = useState<RelationType[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<Mode>(loadMode)
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const [rootId, setRootId] = useState<string | null>(null)
  const [rootQuery, setRootQuery] = useState('')
  const [showRootPicker, setShowRootPicker] = useState(false)

  const { ref: containerRef, size } = useElementSize<HTMLDivElement>()
  const panZoom = usePanZoom(mode === 'tree' ? `tree:${rootId}` : 'network')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const personsTable = canEdit ? 'persons' : 'persons_safe'
      const [personsRes, relRes, types] = await Promise.all([
        supabase.from(personsTable).select('id, nickname, full_name, avatar_url, group_type'),
        supabase.from('relationships').select('*'),
        fetchRelationTypes(),
      ])
      if (!active) return
      setPersons((personsRes.data as DiagramPerson[]) ?? [])
      setRelationships((relRes.data as RelationshipRow[]) ?? [])
      setRelationTypes(types)
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [canEdit])

  const personById = useMemo(() => {
    const map = new Map<string, DiagramPerson>()
    for (const p of persons) map.set(p.id, p)
    return map
  }, [persons])

  const relationTypeByValue = useMemo(() => {
    const map = new Map<string, RelationType>()
    for (const rt of relationTypes) map.set(rt.value, rt)
    return map
  }, [relationTypes])

  function relationTypeLabel(value: string): string {
    return relationTypeByValue.get(value)?.label ?? value
  }

  function personName(id: string): string {
    const p = personById.get(id)
    return p ? personDisplayName(p) : ''
  }

  // Mac dinh chon nguoi co nhieu quan he GIA DINH nhat lam goc cay — chi
  // chay 1 lan (khi chua co rootId) sau khi du lieu tai xong.
  useEffect(() => {
    if (rootId !== null) return
    if (persons.length === 0) return
    const counts = new Map<string, number>()
    for (const r of relationships) {
      if (!FAMILY_RELATION_TYPES.has(r.relation_type)) continue
      counts.set(r.person_a, (counts.get(r.person_a) ?? 0) + 1)
      counts.set(r.person_b, (counts.get(r.person_b) ?? 0) + 1)
    }
    let best: string | null = null
    let bestCount = -1
    for (const p of persons) {
      const c = counts.get(p.id) ?? 0
      if (c > bestCount) {
        bestCount = c
        best = p.id
      }
    }
    setRootId(best)
  }, [persons, relationships, rootId])

  function changeMode(next: Mode) {
    setMode(next)
    setSelectedNodeId(null)
    window.localStorage.setItem(MODE_KEY, next)
  }

  function toggleFilterType(value: string) {
    setFilterTypes((cur) => {
      const next = new Set(cur)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  // --- Du lieu Mang luoi ---------------------------------------------------
  const availableTypesInNetwork = useMemo(
    () => Array.from(new Set(relationships.map((r) => r.relation_type))),
    [relationships],
  )

  const filteredRels = useMemo(
    () =>
      filterTypes.size === 0
        ? relationships
        : relationships.filter((r) => filterTypes.has(r.relation_type)),
    [relationships, filterTypes],
  )

  const networkNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of filteredRels) {
      if (personById.has(r.person_a)) ids.add(r.person_a)
      if (personById.has(r.person_b)) ids.add(r.person_b)
    }
    return Array.from(ids)
  }, [filteredRels, personById])

  const network = useMemo(
    () => buildNetworkLayout(networkNodeIds, filteredRels, size.width, size.height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [networkNodeIds.join(','), filteredRels, size.width, size.height],
  )

  const selectedPerson = selectedNodeId ? (personById.get(selectedNodeId) ?? null) : null
  const selectedPersonRelations = useMemo(() => {
    if (!selectedNodeId) return []
    return relationships
      .filter((r) => r.person_a === selectedNodeId || r.person_b === selectedNodeId)
      .map((r) => {
        const otherId = r.person_a === selectedNodeId ? r.person_b : r.person_a
        return { otherId, otherName: personName(otherId), label: labelForPerspective(r, selectedNodeId) }
      })
      .filter((r) => r.otherName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, selectedNodeId, personById])

  // --- Du lieu Cay gia pha --------------------------------------------------
  const personIdSet = useMemo(() => new Set(persons.map((p) => p.id)), [persons])
  const tree = useMemo(
    () => (rootId ? layoutFamilyTree(relationships, personIdSet, rootId) : { nodes: [], edges: [] }),
    [relationships, personIdSet, rootId],
  )
  const treeNodeById = useMemo(() => {
    const map = new Map<string, FamilyLayoutNode>()
    for (const n of tree.nodes) map.set(n.id, n)
    return map
  }, [tree.nodes])

  const rootPersonName = rootId ? personName(rootId) : ''
  const rootCandidates = useMemo(() => {
    const q = vnNormalize(rootQuery.trim())
    const list = q
      ? persons.filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
      : persons
    return list.slice(0, 8)
  }, [persons, rootQuery])

  function handleNodeClick(id: string) {
    if (panZoom.wasDragged()) return
    setSelectedNodeId((cur) => (cur === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    )
  }

  const totalEmpty = relationships.length === 0

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <h1 className="mb-4 font-heading text-xl font-bold text-ink">{t('diagram.title')}</h1>

      {totalEmpty && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-card border border-line bg-card px-6 text-center">
          <p className="text-sm text-muted">{t('diagram.empty')}</p>
        </div>
      )}

      {!totalEmpty && (
        <>
          {/* Toolbar */}
          <div className="mb-4 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                onClick={() => changeMode('network')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  mode === 'network' ? 'bg-primary text-white' : 'bg-card text-muted hover:text-ink'
                }`}
              >
                {t('diagram.mode_network')}
              </button>
              <button
                type="button"
                onClick={() => changeMode('tree')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  mode === 'tree' ? 'bg-primary text-white' : 'bg-card text-muted hover:text-ink'
                }`}
              >
                {t('diagram.mode_tree')}
              </button>
            </div>

            {mode === 'network' && availableTypesInNetwork.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTypesInNetwork.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleFilterType(value)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      filterTypes.has(value)
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-line bg-card text-muted hover:text-ink'
                    }`}
                  >
                    {relationTypeLabel(value)}
                  </button>
                ))}
                {filterTypes.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTypes(new Set())}
                    className="rounded-full border border-line px-2.5 py-1 text-[10px] font-medium text-muted hover:text-ink"
                  >
                    {t('filters.clear')}
                  </button>
                )}
              </div>
            )}

            {mode === 'tree' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRootPicker((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink"
                >
                  <span className="text-muted">{t('diagram.root_person')}:</span>
                  <span className="max-w-[160px] truncate font-semibold">{rootPersonName || '—'}</span>
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
                          onClick={() => {
                            setRootId(p.id)
                            setShowRootPicker(false)
                            setRootQuery('')
                          }}
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
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="relative h-[70vh] overflow-hidden rounded-card border border-line bg-card"
          >
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
                {mode === 'network' && (
                  <NetworkView
                    nodeIds={networkNodeIds}
                    positions={network.positions}
                    links={network.links}
                    personById={personById}
                    relationTypeLabel={relationTypeLabel}
                    scale={panZoom.view.scale}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={handleNodeClick}
                  />
                )}
                {mode === 'tree' && (
                  <FamilyTreeSvg nodes={tree.nodes} edges={tree.edges} treeNodeById={treeNodeById} personById={personById} />
                )}
              </g>
            </svg>

            {mode === 'tree' && rootId && tree.nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
                <p className="text-sm text-muted">{t('diagram.empty_family')}</p>
              </div>
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
              <button
                type="button"
                aria-label={t('diagram.zoom_in')}
                onClick={() => panZoom.zoomBy(1.25)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-lg font-bold text-ink shadow md:h-9 md:w-9 md:text-base"
              >
                +
              </button>
              <button
                type="button"
                aria-label={t('diagram.zoom_out')}
                onClick={() => panZoom.zoomBy(0.8)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-lg font-bold text-ink shadow md:h-9 md:w-9 md:text-base"
              >
                −
              </button>
            </div>

            {/* Mini card node duoc chon (chi che do Mang luoi) */}
            {mode === 'network' && selectedPerson && (
              <div className="absolute top-3 right-3 w-64 max-w-[80vw] rounded-card border border-line bg-surface p-3 shadow-lg">
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  aria-label="Đóng"
                  className="absolute top-2 right-2 rounded-md p-1 text-muted hover:text-ink"
                >
                  ✕
                </button>
                <div className="mb-2 flex items-center gap-2.5 pr-4">
                  <Avatar
                    name={personDisplayName(selectedPerson)}
                    avatarUrl={selectedPerson.avatar_url}
                    size={38}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-ink">
                      {personDisplayName(selectedPerson)}
                    </div>
                    <div className="truncate text-[10px] text-muted">
                      {t(`groups.${selectedPerson.group_type}`)}
                    </div>
                  </div>
                </div>
                <div className="mb-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {selectedPersonRelations.map((r) => (
                    <div key={`${r.otherId}-${r.label}`} className="flex items-center gap-1.5 text-[10px]">
                      <span className="truncate text-ink">{r.otherName}</span>
                      <span className="truncate rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-primary">
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/nguoi/${selectedPerson.id}`)}
                  className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('diagram.view_profile')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// --- Sub-render: Mang luoi --------------------------------------------------

interface NetworkViewProps {
  nodeIds: string[]
  positions: Map<string, { x: number; y: number }>
  links: { source: string; target: string; relationType: string }[]
  personById: Map<string, DiagramPerson>
  relationTypeLabel: (value: string) => string
  scale: number
  selectedNodeId: string | null
  onNodeClick: (id: string) => void
}

function NetworkView({
  nodeIds,
  positions,
  links,
  personById,
  relationTypeLabel,
  scale,
  selectedNodeId,
  onNodeClick,
}: NetworkViewProps) {
  const showLabels = scale >= ZOOM_LABEL_THRESHOLD

  return (
    <>
      {links.map((l, i) => {
        const a = positions.get(l.source)
        const b = positions.get(l.target)
        if (!a || !b) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        return (
          <g key={`${l.source}-${l.target}-${i}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(249,115,22,0.18)" strokeWidth={1.25} />
            {showLabels && (
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                fontSize={8}
                style={{ fill: '#78716c' }}
              >
                {relationTypeLabel(l.relationType)}
              </text>
            )}
          </g>
        )
      })}

      {nodeIds.map((id) => {
        const pos = positions.get(id)
        const person = personById.get(id)
        if (!pos || !person) return null
        const name = personDisplayName(person)
        const color = GROUP_COLORS[person.group_type]
        const isSelected = id === selectedNodeId
        return (
          <g
            key={id}
            transform={`translate(${pos.x},${pos.y})`}
            onClick={() => onNodeClick(id)}
            className="cursor-pointer"
          >
            <circle
              r={22}
              fill={`${color}33`}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} style={{ fill: color }}>
              {initialsOf(name)}
            </text>
            <text y={34} textAnchor="middle" fontSize={10} style={{ fill: '#faf5f0' }}>
              {truncateName(name)}
            </text>
          </g>
        )
      })}
    </>
  )
}

export default Diagram
