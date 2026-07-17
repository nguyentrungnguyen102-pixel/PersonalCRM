// Resolve avatar_url (co the la URL http(s) day du HOAC storage path trong
// bucket 'media', vi AvatarUpload.tsx luu path) thanh URL hien thi duoc.
// Cache module-level (TTL 50 phut, ngan hon TTL 1h cua signed URL de tranh
// dung URL sap het han) + dedupe cac lan goi dong thoi cho CUNG 1 path.

import { supabase } from './supabase'

const TTL_MS = 50 * 60 * 1000

interface CacheEntry {
  url: string
  expires: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<string | null>>()

function isHttpUrl(value: string): boolean {
  return value.startsWith('http')
}

// Doc dong bo, KHONG goi mang — dung de khoi tao state render lan dau ma
// khong bi nhap nhay (flicker) tu placeholder chu cai dau sang anh that.
export function cachedAvatarUrl(value: string | null): string | null {
  if (!value) return null
  if (isHttpUrl(value)) return value
  const hit = cache.get(value)
  if (hit && hit.expires > Date.now()) return hit.url
  return null
}

export async function resolveAvatarUrl(value: string | null): Promise<string | null> {
  if (!value) return null
  if (isHttpUrl(value)) return value

  const hit = cache.get(value)
  if (hit && hit.expires > Date.now()) return hit.url

  const existing = inFlight.get(value)
  if (existing) return existing

  const promise = (async () => {
    const { data, error } = await supabase.storage.from('media').createSignedUrl(value, 3600)
    inFlight.delete(value)
    if (error || !data?.signedUrl) return null
    cache.set(value, { url: data.signedUrl, expires: Date.now() + TTL_MS })
    return data.signedUrl
  })()

  inFlight.set(value, promise)
  return promise
}

// Goi sau khi upload avatar moi de lan resolve tiep theo khong tra ve
// signed URL cu (dau sao path giu nguyen, URL cu van con hop le nhung tro
// toi noi dung anh cu neu path bi tai su dung — thuc te AvatarUpload luon
// sinh path moi kem timestamp nen day chi la phong ho).
export function invalidateAvatarUrl(path: string): void {
  cache.delete(path)
  inFlight.delete(path)
}
