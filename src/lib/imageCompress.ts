// Nen anh phia client (resize canh dai nhat + xuat JPEG chat luong thap hon)
// — tach tu src/components/MediaAddModal.tsx de dung chung voi AvatarUpload.tsx.
// Hanh vi giu nguyen 100% so voi ban goc.

const MAX_EDGE = 1920
const JPEG_QUALITY = 0.82

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không thể xử lý ảnh')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Không thể nén ảnh')
  return blob
}
