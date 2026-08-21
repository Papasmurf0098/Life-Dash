import { announceDataChange } from '../../shared/events'

export const TIP_STORAGE_KEY = 'shiftDataV5_4'
export const HOURLY_WAGE = 12
export const FOOD_TIP_OUT_RATE = 0.02
export const LIQUOR_TIP_OUT_RATE = 0.08
export const TIP_TAGS = ['good', 'bad', 'slow', 'busy', 'raining', 'cloudy', 'cold', 'hot'] as const

const LEGACY_KEYS = [
  'shiftDataV5_3',
  'shiftDataV5_2',
  'shiftDataV5_1',
  'shiftDataV5',
  'shiftDataV4',
  'shiftDataV3',
  'shiftDataV2',
  'shiftData',
]

export interface ShiftEntry {
  id: string
  date: string
  section: string
  hours: number
  tips: number
  foodSales: number | null
  liquorSales: number | null
  basePay: number
  foodTipOut: number
  liquorTipOut: number
  tipOut: number
  netTips: number
  projectedEarnings: number
  hourly: number
  tags: string[]
  notes: string
}

export interface ShiftTotals {
  shifts: number
  hours: number
  tips: number
  foodSales: number
  liquorSales: number
  basePay: number
  foodTipOut: number
  liquorTipOut: number
  tipOut: number
  netTips: number
  projectedEarnings: number
  avgHourly: number
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `shift_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeSectionName(section: unknown): string {
  const cleaned = String(section ?? '').trim().replace(/\s+/g, ' ')
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeShift(value: unknown): ShiftEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const date = String(raw.date ?? '').trim()
  const section = normalizeSectionName(raw.section)
  const hours = Number(raw.hours ?? 0)
  const tips = Number(raw.tips ?? 0)
  const rawFoodSales = raw.foodSales === '' || raw.foodSales === null || raw.foodSales === undefined
    ? null
    : Number(raw.foodSales)
  const foodSales = rawFoodSales !== null && Number.isFinite(rawFoodSales) ? rawFoodSales : null
  const rawLiquorSales = raw.liquorSales === '' || raw.liquorSales === null || raw.liquorSales === undefined
    ? null
    : Number(raw.liquorSales)
  const liquorSales = rawLiquorSales !== null && Number.isFinite(rawLiquorSales) ? rawLiquorSales : null

  if (
    !date ||
    !section ||
    !Number.isFinite(hours) ||
    !Number.isFinite(tips) ||
    hours <= 0 ||
    tips < 0 ||
    (foodSales !== null && foodSales < 0) ||
    (liquorSales !== null && liquorSales < 0)
  ) return null

  const basePay = roundMoney(hours * HOURLY_WAGE)
  const foodTipOut = roundMoney((foodSales ?? 0) * FOOD_TIP_OUT_RATE)
  const liquorTipOut = roundMoney((liquorSales ?? 0) * LIQUOR_TIP_OUT_RATE)
  const tipOut = roundMoney(foodTipOut + liquorTipOut)
  const netTips = roundMoney(tips - tipOut)
  const projectedEarnings = roundMoney(basePay + netTips)
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map(String).map((tag) => tag.trim().toLowerCase()).filter((tag) => TIP_TAGS.includes(tag as (typeof TIP_TAGS)[number])))]
    : []

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    date,
    section,
    hours,
    tips: roundMoney(tips),
    foodSales: foodSales === null ? null : roundMoney(foodSales),
    liquorSales: liquorSales === null ? null : roundMoney(liquorSales),
    basePay,
    foodTipOut,
    liquorTipOut,
    tipOut,
    netTips,
    projectedEarnings,
    hourly: roundMoney(projectedEarnings / hours),
    tags,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
  }
}

export function parseShiftEntries(value: unknown): ShiftEntry[] {
  if (!Array.isArray(value)) throw new Error('Tip Tracker data must be a list of shifts.')
  return value
    .flatMap((entry) => {
      const shift = normalizeShift(entry)
      return shift ? [shift] : []
    })
    .toSorted((left, right) => left.date.localeCompare(right.date))
}

export function loadShiftEntries(): ShiftEntry[] {
  if (typeof window === 'undefined') return []
  for (const key of [TIP_STORAGE_KEY, ...LEGACY_KEYS]) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const entries = parseShiftEntries(JSON.parse(raw))
      const serialized = JSON.stringify(entries)
      if (key !== TIP_STORAGE_KEY || serialized !== raw) {
        window.localStorage.setItem(TIP_STORAGE_KEY, serialized)
      }
      return entries
    } catch {
      window.localStorage.setItem(`${key}-recovery`, raw)
    }
  }
  return []
}

export function saveShiftEntries(entries: ShiftEntry[]): void {
  if (typeof window === 'undefined') return
  const normalized = entries.flatMap((entry) => {
    const shift = normalizeShift(entry)
    return shift ? [shift] : []
  })
  window.localStorage.setItem(TIP_STORAGE_KEY, JSON.stringify(normalized))
  announceDataChange('tips')
}

export function aggregateShifts(entries: ShiftEntry[]): ShiftTotals {
  const totals = entries.reduce(
    (result, shift) => ({
      shifts: result.shifts + 1,
      hours: result.hours + shift.hours,
      tips: result.tips + shift.tips,
      foodSales: result.foodSales + (shift.foodSales ?? 0),
      liquorSales: result.liquorSales + (shift.liquorSales ?? 0),
      basePay: result.basePay + shift.basePay,
      foodTipOut: result.foodTipOut + shift.foodTipOut,
      liquorTipOut: result.liquorTipOut + shift.liquorTipOut,
      tipOut: result.tipOut + shift.tipOut,
      netTips: result.netTips + shift.netTips,
      projectedEarnings: result.projectedEarnings + shift.projectedEarnings,
      avgHourly: 0,
    }),
    { shifts: 0, hours: 0, tips: 0, foodSales: 0, liquorSales: 0, basePay: 0, foodTipOut: 0, liquorTipOut: 0, tipOut: 0, netTips: 0, projectedEarnings: 0, avgHourly: 0 },
  )
  return {
    ...totals,
    tips: roundMoney(totals.tips),
    foodSales: roundMoney(totals.foodSales),
    liquorSales: roundMoney(totals.liquorSales),
    basePay: roundMoney(totals.basePay),
    foodTipOut: roundMoney(totals.foodTipOut),
    liquorTipOut: roundMoney(totals.liquorTipOut),
    tipOut: roundMoney(totals.tipOut),
    netTips: roundMoney(totals.netTips),
    projectedEarnings: roundMoney(totals.projectedEarnings),
    avgHourly: totals.hours ? roundMoney(totals.projectedEarnings / totals.hours) : 0,
  }
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getFridayWeekRange(baseDate = new Date()): { start: Date; end: Date } {
  const date = new Date(baseDate)
  date.setHours(0, 0, 0, 0)
  const diffToFriday = date.getDay() >= 5 ? date.getDay() - 5 : date.getDay() + 2
  const start = new Date(date)
  start.setDate(date.getDate() - diffToFriday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

export function getCurrentWeekShifts(entries: ShiftEntry[], now = new Date()): ShiftEntry[] {
  const { start, end } = getFridayWeekRange(now)
  const startKey = toLocalDateString(start)
  const endKey = toLocalDateString(end)
  return entries.filter((entry) => entry.date >= startKey && entry.date <= endKey)
}

export function projectCurrentMonthEarnings(entries: ShiftEntry[], now = new Date()): number {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const elapsedDays = Math.max(1, now.getDate())
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthToDate = entries.filter((entry) => entry.date.startsWith(monthKey) && entry.date <= toLocalDateString(now))
  return roundMoney((aggregateShifts(monthToDate).projectedEarnings / elapsedDays) * daysInMonth)
}
