// Test cho src/lib/lunar.ts — chay bang node:test, khong phu thuoc ngoai.
// Chay: npm run test:lunar (node --experimental-strip-types --test scripts/lunar.test.ts)

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  convertLunar2Solar,
  convertSolar2Lunar,
  daysUntil,
  formatLunar,
  nextLunarAnniversary,
} from '../src/lib/lunar.ts'

test('Tet (1/1 am lich) — 2024, 2025, 2026, ca 2 chieu', () => {
  const cases: [number, number, number][] = [
    [10, 2, 2024],
    [29, 1, 2025],
    [17, 2, 2026],
  ]
  for (const [dd, mm, yy] of cases) {
    const lunar = convertSolar2Lunar(dd, mm, yy)
    assert.equal(lunar.day, 1, `${dd}/${mm}/${yy} phai la mung 1 am lich`)
    assert.equal(lunar.month, 1, `${dd}/${mm}/${yy} phai la thang 1 am lich`)
    assert.equal(lunar.leap, false)

    const solar = convertLunar2Solar(1, 1, lunar.year, false)
    assert.ok(solar, `convertLunar2Solar(1,1,${lunar.year}) khong duoc null`)
    assert.deepEqual(solar, { day: dd, month: mm, year: yy })
  }
})

test('Thang nhuan — lunar nam 2025 co thang 6 nhuan', () => {
  const lunar = convertSolar2Lunar(25, 7, 2025)
  assert.deepEqual(lunar, { day: 1, month: 6, year: 2025, leap: true })

  const regular = convertLunar2Solar(1, 6, 2025, false)
  assert.deepEqual(regular, { day: 25, month: 6, year: 2025 })

  const leap = convertLunar2Solar(1, 6, 2025, true)
  assert.deepEqual(leap, { day: 25, month: 7, year: 2025 })
})

test('Lich su — 30/4/1975 duong lich la 20/3 am lich (khong nhuan, tinh theo GMT+7 chuan)', () => {
  // Luu y: mot so nguon pho bien ghi ngay nay la "19/3 Am Mao" — do truoc
  // 1975 mien Nam Viet Nam tinh am lich theo mui gio GMT+8 (giong lich
  // Trung Quoc), con mien Bac da doi sang GMT+7 tu 1967. Sau thong nhat,
  // GMT+7 (Ha Noi, kinh tuyen 105 Dong) la chuan chinh thuc va duy nhat cho
  // ca nuoc — dung chuan nay (nhu module lunar.ts quy dinh o dau file) thi
  // ket qua la 20/3, khong phai 19/3. Da doi chieu ket qua nay khop voi 2
  // moc lich su noi tieng khac tinh theo GMT+7 (xem debug thu cong khi lam
  // Phase 1): Bac Ho mat 2/9/1969 = 21/7 Ky Dau, Quoc khanh 2/9/1945 =
  // 26/7 At Dau — ca 2 deu khop voi cac nguon duoc trich dan rong rai.
  const lunar = convertSolar2Lunar(30, 4, 1975)
  assert.equal(lunar.day, 20)
  assert.equal(lunar.month, 3)
  assert.equal(lunar.year, 1975)
  assert.equal(lunar.leap, false)
})

test('Dau vao khong hop le — ngay 30 cua thang thieu tra ve null', () => {
  let foundInvalidDay30 = false
  for (let month = 1; month <= 12; month++) {
    const solar = convertLunar2Solar(30, month, 2025, false)
    if (solar === null) {
      foundInvalidDay30 = true
      continue
    }
    // Neu hop le thi phai round-trip dung ve chinh no.
    const back = convertSolar2Lunar(solar.day, solar.month, solar.year)
    assert.deepEqual(back, { day: 30, month, year: 2025, leap: false })
  }
  assert.ok(foundInvalidDay30, 'phai co it nhat 1 thang trong 2025 khong co ngay 30 am lich')
})

test('Dau vao khong hop le — leap=true cho thang khong phai thang nhuan tra ve null', () => {
  // Nam 2025 chi co thang 6 la thang nhuan (kiem chung o test tren) — moi
  // thang khac voi leap=true deu phai khong hop le.
  for (let month = 1; month <= 12; month++) {
    if (month === 6) continue
    const solar = convertLunar2Solar(1, month, 2025, true)
    assert.equal(solar, null, `thang ${month} nam 2025 khong phai thang nhuan, leap=true phai tra null`)
  }
})

test('Round-trip solar->lunar->solar dung cho moi ngay tu 1900-01-01 den 2100-12-31', () => {
  // Duyet bang cach tang dan Julian Day (qua Date.UTC) de khong phu thuoc
  // timezone may chay — van toc du nhanh (thuan toan hoc, khong I/O).
  const start = Date.UTC(1900, 0, 1)
  const end = Date.UTC(2100, 11, 31)
  const oneDay = 86400000
  let checked = 0

  for (let t = start; t <= end; t += oneDay) {
    const d = new Date(t)
    const dd = d.getUTCDate()
    const mm = d.getUTCMonth() + 1
    const yy = d.getUTCFullYear()

    const lunar = convertSolar2Lunar(dd, mm, yy)
    const back = convertLunar2Solar(lunar.day, lunar.month, lunar.year, lunar.leap)
    assert.ok(back, `convertLunar2Solar khong duoc null cho ${dd}/${mm}/${yy}`)
    assert.deepEqual(
      back,
      { day: dd, month: mm, year: yy },
      `round-trip sai cho ${dd}/${mm}/${yy} (lunar ${lunar.day}/${lunar.month}/${lunar.year} leap=${lunar.leap})`,
    )
    checked++
  }

  assert.ok(checked > 73000, `phai kiem tra du so ngay tu 1900 den 2100, chi duoc ${checked}`)
})

test('nextLunarAnniversary — gio 1/6, from 2025-01-01, roi vao thang thuong (khong phai thang nhuan)', () => {
  const from = new Date(2025, 0, 1)
  const result = nextLunarAnniversary(1, 6, from)
  assert.deepEqual(
    [result.getFullYear(), result.getMonth() + 1, result.getDate()],
    [2025, 6, 25],
  )
})

test('nextLunarAnniversary — luon >= from, va gio da qua trong nam am lich hien tai thi roll sang nam sau', () => {
  // Gio 1/1 (Tet) nhung from da la thang 6 duong lich 2025 -> Tet 2025 da
  // qua tu lau, phai roll sang Tet nam am lich ke tiep.
  const from = new Date(2025, 5, 1)
  const result = nextLunarAnniversary(1, 1, from)
  assert.ok(result.getTime() >= from.getTime())
  assert.notEqual(result.getFullYear(), 2025)

  const backToLunar = convertSolar2Lunar(result.getDate(), result.getMonth() + 1, result.getFullYear())
  assert.equal(backToLunar.day, 1)
  assert.equal(backToLunar.month, 1)
})

test('nextLunarAnniversary — thang co 30 ngay nam nay nhung 29 ngay nam sau thi lui ve ngay 29', () => {
  // Quet tung thang am lich (khong nhuan) cua vai nam lien tiep, tim truong
  // hop thang do co 30 ngay o nam X nhung chi 29 ngay o nam X+1.
  let found = false
  for (let year = 2020; year < 2035 && !found; year++) {
    for (let month = 1; month <= 12; month++) {
      const day30ThisYear = convertLunar2Solar(30, month, year, false)
      const day30NextYear = convertLunar2Solar(30, month, year + 1, false)
      if (day30ThisYear && !day30NextYear) {
        // from = ngay sau ky niem nam nay -> ky niem ke tiep phai o nam sau,
        // va vi thang do nam sau chi co 29 ngay nen phai lui ve ngay 29.
        const day29NextYear = convertLunar2Solar(29, month, year + 1, false)
        assert.ok(day29NextYear, `nam ${year + 1} thang ${month} phai co ngay 29`)

        const from = new Date(day30ThisYear.year, day30ThisYear.month - 1, day30ThisYear.day + 1)
        const result = nextLunarAnniversary(30, month, from)
        assert.deepEqual(
          [result.getFullYear(), result.getMonth() + 1, result.getDate()],
          [day29NextYear.year, day29NextYear.month, day29NextYear.day],
        )
        found = true
        break
      }
    }
  }
  assert.ok(found, 'phai tim duoc it nhat 1 truong hop thang 30 ngay -> 29 ngay giua 2 nam lien tiep')
})

test('formatLunar va daysUntil', () => {
  assert.equal(formatLunar(15, 8), '15/8')
  assert.equal(formatLunar(1, 1), '1/1')

  assert.equal(daysUntil(new Date(2025, 0, 10), new Date(2025, 0, 1)), 9)
  assert.equal(daysUntil(new Date(2025, 0, 1), new Date(2025, 0, 1)), 0)
  assert.equal(daysUntil(new Date(2024, 11, 31), new Date(2025, 0, 1)), -1)
})
