// Xuat 1 phan tu SVG (cay gia pha o che do printMode, xem
// src/components/diagram/FamilyTreeSvg.tsx) ra file PNG tai truc tiep ve
// may nguoi dung — thuan client, khong goi server. Dung cho nut "Xuat anh
// PNG" tren trang /gia-pha (xem src/pages/GiaPha.tsx).
//
// Nen PNG luon la mau toi (#080407, trung --color-bg trong index.css) vi
// text/net trong cay duoc thiet ke cho nen toi (mau chu/vien sang) — xuat
// tren nen trang se khong doc duoc.

const EXPORT_BG = '#080407'
const BBOX_PADDING = 16

interface ContentBounds {
  x: number
  y: number
  width: number
  height: number
}

// Uu tien viewBox neu SVG nguon da khai bao san (truong hop GiaPha.tsx tu
// tinh kich thuoc theo toa do cay va gan viewBox tuong ung) — chinh xac hon
// getBBox() vi khong phu thuoc SVG co dang render trong DOM luc goi hay
// khong. Fallback getBBox() + padding nho cho cac truong hop khac.
function contentBoundsOf(svg: SVGSVGElement): ContentBounds {
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      const [x, y, width, height] = parts
      return { x, y, width, height }
    }
  }
  const bbox = svg.getBBox()
  return {
    x: bbox.x - BBOX_PADDING,
    y: bbox.y - BBOX_PADDING,
    width: bbox.width + BBOX_PADDING * 2,
    height: bbox.height + BBOX_PADDING * 2,
  }
}

export async function exportSvgToPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const bounds = contentBoundsOf(svg)
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('Cay gia pha trong, khong co gi de xuat.')
  }

  // Clone de khong dong cham DOM that (svg nguon co the dang o che do
  // offscreen/hidden, xem GiaPha.tsx) — gan kich thuoc pixel that (khong
  // phai % hay 100vh) truoc khi serialize.
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(bounds.width))
  clone.setAttribute('height', String(bounds.height))
  clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', String(bounds.x))
  bg.setAttribute('y', String(bounds.y))
  bg.setAttribute('width', String(bounds.width))
  bg.setAttribute('height', String(bounds.height))
  bg.setAttribute('fill', EXPORT_BG)
  clone.insertBefore(bg, clone.firstChild)

  const serialized = new XMLSerializer().serializeToString(clone)
  // KHONG dung btoa: ten nguoi tieng Viet co dau (unicode) se lam btoa nem
  // loi "invalid character". encodeURIComponent xu ly duoc unicode.
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Khong tai duoc anh SVG de xuat PNG.'))
    img.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bounds.width * scale)
  canvas.height = Math.round(bounds.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Trinh duyet khong ho tro canvas 2D.')
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    throw new Error('Khong tao duoc file PNG.')
  }

  // Tai ve qua the <a download> + object URL — hoat dong tren iOS Safari
  // (khac voi navigator.msSaveBlob, API cu chi co tren IE/Edge legacy).
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
