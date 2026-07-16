// Renderer SVG cua "Cay gia pha" — tach nguyen ven tu src/pages/Diagram.tsx
// (component TreeView cu, doi ten thanh FamilyTreeSvg) + 2 helper hien thi
// ten (truncateName/initialsOf — initialsOf van duoc Diagram.tsx dung lai
// cho che do Mang luoi, xem ghi chu tai noi import o Diagram.tsx).
//
// Props mo rong (OPTIONAL, mac dinh khong lam gi — giu /so-do y het cu):
// - sideOf: to vien tren + accent mau theo "phia" (chong/vo/con chung),
//   dung cho trang /gia-pha (xem src/lib/familyLayout.ts computeFamilySides).
// - deceasedIds: nguoi da mat hien dau 🕯 canh ten + ten mau muted.
// - onSelectPerson: callback khi bam vao 1 node — Diagram.tsx (/so-do)
//   khong truyen (tree mode o do von khong co click-to-profile) nen hanh vi
//   khong doi; GiaPha.tsx truyen navigate(`/nguoi/:id`).
// - printMode: bat che do xuat anh/in (xem src/lib/svgExport.ts va
//   src/pages/GiaPha.tsx) — node ve BANG SVG THUAN (rect/circle/text), KHONG
//   dung foreignObject/img/class Tailwind, de serialize sach va khong bi
//   "taint" canvas khi rasterize. Che do mac dinh (printMode falsy) giu
//   NGUYEN VEN nhu truoc — /so-do khong truyen prop nay nen khong doi hanh vi.
// - yearsOf: chi dung trong printMode — tra ve chuoi "1932–2001" (hoac null)
//   de hien dong thu 2 cua the; khong truyen/tra null thi dong nay an luon
//   (khac voi che do tuong tac luon hien nhan nhom).

import { useLabels } from '../../hooks/useSettings'
import { displayName as personDisplayName } from '../../lib/displayName'
import type { FamilyLayoutEdge, FamilyLayoutNode } from '../../lib/familyLayout'
import { NODE_W } from '../../lib/familyLayout'
import type { FamilySide } from '../../lib/familyLayout'
import type { GroupType } from '../../lib/types'
import { Avatar } from '../Avatar'
import { GROUP_COLORS } from '../PersonCard'
import { FAMILY_SIDE_COLORS, initialsOf, truncateName } from './treeDisplay'

export interface FamilyTreeSvgPerson {
  nickname: string | null
  full_name: string
  avatar_url: string | null
  group_type: GroupType
}

interface FamilyTreeSvgProps<P extends FamilyTreeSvgPerson> {
  nodes: FamilyLayoutNode[]
  edges: FamilyLayoutEdge[]
  treeNodeById: Map<string, FamilyLayoutNode>
  personById: Map<string, P>
  sideOf?: Map<string, FamilySide>
  deceasedIds?: Set<string>
  onSelectPerson?: (id: string) => void
  printMode?: boolean
  yearsOf?: (id: string) => string | null
}

export function FamilyTreeSvg<P extends FamilyTreeSvgPerson>({
  nodes,
  edges,
  treeNodeById,
  personById,
  sideOf,
  deceasedIds,
  onSelectPerson,
  printMode = false,
  yearsOf,
}: FamilyTreeSvgProps<P>) {
  const { t } = useLabels()
  const cardW = NODE_W
  const cardH = 58

  return (
    <>
      {edges.map((e, i) => {
        const from = treeNodeById.get(e.from)
        const to = treeNodeById.get(e.to)
        if (!from || !to) return null

        if (e.type === 'couple') {
          const y1 = from.y + cardH / 2 - 3
          const y2 = from.y + cardH / 2 + 3
          const x1 = Math.min(from.x, to.x) + cardW / 2
          const x2 = Math.max(from.x, to.x) + cardW / 2
          return (
            <g key={`couple-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y1} stroke="rgba(249,115,22,0.4)" strokeWidth={1.5} />
              <line x1={x1} y1={y2} x2={x2} y2={y2} stroke="rgba(249,115,22,0.4)" strokeWidth={1.5} />
            </g>
          )
        }

        if (e.type === 'other') {
          const x1 = from.x + cardW / 2
          const x2 = to.x + cardW / 2
          const y = from.y + cardH / 2
          return (
            <line
              key={`other-${i}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="rgba(249,115,22,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )
        }

        // parent: duong gap khuc tu (giua cap neu co, hoac chinh nguoi do)
        // xuong giua o con.
        let fromX = from.x + cardW / 2
        if (e.midFrom) {
          const partnerEdge = edges.find(
            (pe) => pe.type === 'couple' && (pe.from === e.from || pe.to === e.from),
          )
          if (partnerEdge) {
            const partnerId = partnerEdge.from === e.from ? partnerEdge.to : partnerEdge.from
            const partner = treeNodeById.get(partnerId)
            if (partner) fromX = (from.x + partner.x) / 2 + cardW / 2
          }
        }
        const fromY = from.y + cardH
        const toX = to.x + cardW / 2
        const toY = to.y
        const midY = (fromY + toY) / 2
        return (
          <polyline
            key={`parent-${i}`}
            points={`${fromX},${fromY} ${fromX},${midY} ${toX},${midY} ${toX},${toY}`}
            fill="none"
            stroke="rgba(249,115,22,0.35)"
            strokeWidth={1.25}
          />
        )
      })}

      {nodes.map((n) => {
        const person = personById.get(n.id)
        if (!person) return null
        const name = personDisplayName(person)
        const color = GROUP_COLORS[person.group_type]
        const side = sideOf?.get(n.id)
        const sideColor = side ? FAMILY_SIDE_COLORS[side] : null
        const deceased = deceasedIds?.has(n.id) ?? false

        if (printMode) {
          const avatarR = 15
          const avatarCx = n.x + 6 + avatarR
          const avatarCy = n.y + cardH / 2
          const textX = avatarCx + avatarR + 6
          const years = yearsOf?.(n.id) ?? null
          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={cardW}
                height={cardH}
                rx={8}
                fill="rgba(255,248,240,0.05)"
                stroke={`${color}55`}
                strokeWidth={1}
              />
              {sideColor && <rect x={n.x} y={n.y} width={cardW} height={3} fill={sideColor} />}
              <circle cx={avatarCx} cy={avatarCy} r={avatarR} fill="#1f1116" />
              <text
                x={avatarCx}
                y={avatarCy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={700}
                fill="#f97316"
              >
                {initialsOf(name)}
              </text>
              <text
                x={textX}
                y={n.y + (years ? 23 : cardH / 2 + 3)}
                fontSize={10}
                fontWeight={600}
                fill={deceased ? '#9c8f85' : '#f5ede4'}
              >
                {deceased ? `🕯 ${truncateName(name)}` : truncateName(name)}
              </text>
              {years && (
                <text x={textX} y={n.y + 36} fontSize={8} fill="#9c8f85">
                  {years}
                </text>
              )}
            </g>
          )
        }

        return (
          <foreignObject key={n.id} x={n.x} y={n.y} width={cardW} height={cardH}>
            <div
              style={{
                borderColor: `${color}55`,
                background: 'rgba(255,248,240,0.03)',
                ...(sideColor
                  ? { borderTopColor: sideColor, borderTopWidth: 3 }
                  : undefined),
              }}
              onClick={onSelectPerson ? () => onSelectPerson(n.id) : undefined}
              className={
                onSelectPerson
                  ? 'flex h-full w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1'
                  : 'flex h-full w-full items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1'
              }
              title={name}
            >
              <Avatar name={name} avatarUrl={person.avatar_url} size={30} />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-[10px] font-semibold ${deceased ? 'text-muted' : 'text-ink'}`}
                >
                  {deceased && <span aria-hidden>🕯 </span>}
                  {truncateName(name)}
                </div>
                <div className="truncate text-[8px] text-muted">{t(`groups.${person.group_type}`)}</div>
              </div>
            </div>
          </foreignObject>
        )
      })}
    </>
  )
}

export default FamilyTreeSvg
