// BAN SAO THU CONG cua src/lib/lunar.ts (khong import truc tiep tu src/ vi
// Deno khong resolve duoc alias/tooling cua Vite — cung ly do voi
// _shared/normalize.ts, xem header file do). PHAI GIU DONG BO voi ban goc
// moi khi sua logic am lich — sua ca 2 noi.
//
// Lich am duong lich Viet Nam — thuat toan Ho Ngoc Duc, dua tren cong thuc
// thien van (vi tri Mat Troi/Mat Trang) cua Jean Meeus "Astronomical
// Algorithms", ap dung mui gio dia phuong Viet Nam (+7, UTC+7 co dinh,
// khong xet gio mua he). Day la ban port TypeScript cua thuat toan goc,
// duoc dung rong rai trong cac ung dung lich Viet Nam.
// Nguon tham khao: https://www.informatik.uni-leipzig.de/~duc/amlich/
//
// Module thuan (pure): khong import gi, khong phu thuoc DOM/React/state,
// chi tinh toan bang so hoc + luong giac.
//
// QUY UOC NGAY GIO (ky niem hang nam theo am lich, dung cho nextLunarAnniversary):
// (a) Neu nam am lich co thang nhuan TRUNG TEN voi thang gio (vd gio thang
//     6, nam do co thang 6 nhuan), gio CHI cu hanh vao THANG THUONG
//     (leap = false) — khong bao gio doi sang thang nhuan.
// (b) Neu ngay gio la 30 nhung thang do nam do la thang THIEU (chi co 29
//     ngay) — khong ton tai ngay 30 — thi gio lui ve ngay 29.
//
// Thuat toan goc (convertLunar2Solar/convertSolar2Lunar kieu C/JS truyen
// thong) KHONG tu bao loi khi dau vao khong hop le (vd ngay 30 cua thang
// chi co 29 ngay, hoac leap=true cho mot thang khong phai la thang nhuan
// cua nam do) — no am tham tra ve ket qua sai lech (JD roi sang thang ke
// tiep, hoac bo ba so 0). Ban port nay tu kiem tra bang round-trip: doi
// lunar -> solar xong doi nguoc solar -> lunar, neu khong khop dau vao goc
// thi coi la khong hop le va tra ve null (xem convertLunar2Solar).

const TIME_ZONE = 7 // Viet Nam, UTC+7 co dinh

function INT(d: number): number {
  return Math.floor(d)
}

// --- 1. Julian day <-> ngay duong lich (Gregorian/Julian calendar) --------
// (jdFromDate/jdToDate giu noi bo — chi phuc vu cac ham tinh am lich ben
// duoi, khong can thiet phai export ra ngoai module.)

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083
  }
  return jd
}

function jdToDate(jd: number): [number, number, number] {
  let a: number
  let b: number
  let c: number
  if (jd > 2299160) {
    // Sau 5/10/1582 — lich Gregory
    a = jd + 32044
    b = INT((4 * a + 3) / 146097)
    c = a - INT((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = INT((4 * c + 3) / 1461)
  const e = c - INT((1461 * d) / 4)
  const m = INT((5 * e + 2) / 153)
  const day = e - INT((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * INT(m / 10)
  const year = b * 100 + d - 4800 + INT(m / 10)
  return [day, month, year]
}

// --- 2. Vi tri Mat Trang (newMoon) / Mat Troi (sunLongitude) --------------
// Cong thuc xap xi Jean Meeus, do chinh xac du dung cho lich am duong VN.

function newMoon(k: number): number {
  const T = k / 1236.85 // so the ky Julian tinh tu 1900-01-00.5
  const T2 = T * T
  const T3 = T2 * T
  const dr = Math.PI / 180
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr) // trang moc trung binh
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3 // di thuong Mat Troi
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3 // di thuong Mat Trang
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3 // do vi Mat Trang
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  let deltaT: number
  if (T < -11) {
    deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  return jd1 + c1 - deltaT
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525 // so the ky Julian tinh tu 2000-01-01 12:00 GMT
  const T2 = T * T
  const dr = Math.PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2 // di thuong trung binh
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2 // kinh do trung binh
  let dl = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  dl = dl + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + dl // kinh do thuc (do)
  L *= dr
  L -= Math.PI * 2 * INT(L / (Math.PI * 2)) // chuan hoa ve (0, 2*PI)
  return L
}

function getNewMoonDay(k: number, timeZone: number): number {
  return INT(newMoon(k) + 0.5 + timeZone / 24)
}

function getSunLongitude(jdn: number, timeZone: number): number {
  return INT((sunLongitude(jdn - 0.5 - timeZone / 24) / Math.PI) * 6)
}

// Julian day cua ngay bat dau thang 11 am lich (thang co Dong Chi) cua nam
// duong lich yy — moc chuan de tinh cac thang am lich con lai trong nam.
function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = getNewMoonDay(k, timeZone)
  const sunLong = getSunLongitude(nm, timeZone)
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone)
  }
  return nm
}

// So thang tinh tu thang 11 (a11) den thang nhuan trong nam am lich do (chi
// goi khi khoang cach 2 moc thang-11 lien tiep > 365 ngay, tuc nam do co 13
// thang am lich).
function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0
  let i = 1 // bat dau tu thang ke sau thang 11
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  do {
    last = arc
    i += 1
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc !== last && i < 14)
  return i - 1
}

// --- 3. Doi qua lai duong lich <-> am lich (noi bo, tra ve tuple tho) -----

function solarToLunarRaw(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number,
): [day: number, month: number, year: number, leap: number] {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1, timeZone)
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone)
  }
  let a11 = getLunarMonth11(yy, timeZone)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = yy
    a11 = getLunarMonth11(yy - 1, timeZone)
  } else {
    lunarYear = yy + 1
    b11 = getLunarMonth11(yy + 1, timeZone)
  }
  const lunarDay = dayNumber - monthStart + 1
  const diff = INT((monthStart - a11) / 29)
  let lunarLeap = 0
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) {
        lunarLeap = 1
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth -= 12
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap]
}

// Tra ve [0, 0, 0] khi dau vao khong hop le (vd leap=true nhung nam do
// khong co thang nhuan trung ten) — convertLunar2Solar se loc lai bang
// round-trip check ben duoi, KHONG dua thang lay truc tiep gia tri nay.
function lunarToSolarRaw(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap: number,
  timeZone: number,
): [day: number, month: number, year: number] {
  let a11: number
  let b11: number
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone)
    b11 = getLunarMonth11(lunarYear, timeZone)
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone)
    b11 = getLunarMonth11(lunarYear + 1, timeZone)
  }
  let off = lunarMonth - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) {
      return [0, 0, 0]
    } else if (lunarLeap !== 0 || off >= leapOff) {
      off += 1
    }
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853 + off)
  const monthStart = getNewMoonDay(k, timeZone)
  return jdToDate(monthStart + lunarDay - 1)
}

// --- 4. API cong khai -------------------------------------------------

export interface SolarDate {
  day: number
  month: number
  year: number
}

export interface LunarDate {
  day: number
  month: number
  year: number
  leap: boolean
}

export function convertSolar2Lunar(dd: number, mm: number, yy: number): LunarDate {
  const [day, month, year, leap] = solarToLunarRaw(dd, mm, yy, TIME_ZONE)
  return { day, month, year, leap: leap === 1 }
}

// Tra ve null khi ngay/thang/nam/leap am lich dau vao khong ton tai trong
// thuc te (vd ngay 30 cua mot thang chi co 29 ngay, hoac leap=true cho mot
// thang khong phai thang nhuan cua nam do) — xem giai thich round-trip o
// dau file.
export function convertLunar2Solar(
  day: number,
  month: number,
  year: number,
  leap: boolean,
): SolarDate | null {
  const [dd, mm, yy] = lunarToSolarRaw(day, month, year, leap ? 1 : 0, TIME_ZONE)
  if (dd === 0 || mm === 0 || yy === 0) return null

  const back = convertSolar2Lunar(dd, mm, yy)
  if (back.day !== day || back.month !== month || back.year !== year || back.leap !== leap) {
    return null
  }
  return { day: dd, month: mm, year: yy }
}

// Ngay duong lich ke tiep (>= from, so sanh theo ngay/thang/nam, khong xet
// gio) ung voi ngay gio am lich hang nam (lunarDay, lunarMonth). Ap dung 2
// chinh sach gio o dau file: (a) khong bao gio roi vao thang nhuan trung
// ten, (b) tu dong lui ve ngay 29 neu thang do nam do la thang thieu.
export function nextLunarAnniversary(lunarDay: number, lunarMonth: number, from: Date): Date {
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const fromLunar = convertSolar2Lunar(from.getDate(), from.getMonth() + 1, from.getFullYear())

  // Thu tu fromLunar.year, +1, +2 — du de tim ngay ke tiep vi moi nam am
  // lich chi lech duong lich vai ngay, khong bao gio can xa hon 2 nam.
  for (let offset = 0; offset <= 2; offset++) {
    const candidateYear = fromLunar.year + offset
    let solar = convertLunar2Solar(lunarDay, lunarMonth, candidateYear, false)
    if (!solar && lunarDay === 30) {
      solar = convertLunar2Solar(29, lunarMonth, candidateYear, false) // chinh sach (b)
    }
    if (!solar) continue

    const candidateDate = new Date(solar.year, solar.month - 1, solar.day)
    if (candidateDate.getTime() >= fromMidnight.getTime()) {
      return candidateDate
    }
  }

  // Khong the xay ra voi lunarDay 1-30 / lunarMonth 1-12 hop le — thang
  // thuong (leap=false) luon ton tai moi nam nen fallback ngay 29 luon
  // thanh cong; day chi la phong ho neu co loi du lieu dau vao.
  throw new Error(`nextLunarAnniversary: khong tinh duoc ngay cho ${lunarDay}/${lunarMonth}`)
}

// Dinh dang ngay/thang am lich ngan gon vd "15/8" — noi goi tu ghep them
// hau to nhan 'person.lunar_suffix' (ÂL) ben ngoai.
export function formatLunar(day: number, month: number): string {
  return `${day}/${month}`
}

// So ngay tron (theo lich, khong xet gio) tu `from` den `target`.
export function daysUntil(target: Date, from: Date): number {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  return Math.round((t - f) / 86400000)
}
