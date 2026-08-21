import { announceDataChange } from '../../shared/events'

export const BULLETIN_STORAGE_KEY = 'bulletin-app-items-v5'
const LEGACY_KEYS = [
  'bulletin-app-items-v4',
  'bulletin-app-items-v3',
  'bulletin-app-items-v2',
  'bulletin-app-items-v1',
]

export type BulletinPriority = 'critical' | 'important' | 'normal' | 'backBurner'
export type BulletinStatus = 'active' | 'completed'

export interface BulletinItem {
  id: string
  title: string
  notes: string
  priority: BulletinPriority
  status: BulletinStatus
  createdAt: string
  updatedAt: string
  dueDate: string | null
  dueTime: string | null
  completedAt: string | null
  isPinned: boolean
}

export const PRIORITY_META: Record<BulletinPriority, { label: string; weight: number }> = {
  critical: { label: 'Critical', weight: 4 },
  important: { label: 'Important', weight: 3 },
  normal: { label: 'Normal', weight: 2 },
  backBurner: { label: 'Back Burner', weight: 1 },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `bulletin_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function normalizeBulletinItem(value: unknown): BulletinItem | null {
  if (!isRecord(value) || typeof value.title !== 'string' || !value.title.trim()) return null

  const priority = Object.hasOwn(PRIORITY_META, String(value.priority))
    ? (value.priority as BulletinPriority)
    : 'normal'
  const status: BulletinStatus = value.status === 'completed' ? 'completed' : 'active'
  const now = new Date().toISOString()

  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    title: value.title.trim(),
    notes: typeof value.notes === 'string' ? value.notes.trim() : '',
    priority,
    status,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    dueDate: typeof value.dueDate === 'string' && value.dueDate ? value.dueDate : null,
    dueTime: typeof value.dueTime === 'string' && value.dueTime ? value.dueTime : null,
    completedAt:
      status === 'completed'
        ? typeof value.completedAt === 'string'
          ? value.completedAt
          : now
        : null,
    isPinned: value.isPinned === true,
  }
}

export function parseBulletinItems(value: unknown): BulletinItem[] {
  if (!Array.isArray(value)) throw new Error('Bulletin data must be a list of items.')
  return value.flatMap((item) => {
    const normalized = normalizeBulletinItem(item)
    return normalized ? [normalized] : []
  })
}

export function loadBulletinItems(): BulletinItem[] {
  if (typeof window === 'undefined') return []

  const keys = [BULLETIN_STORAGE_KEY, ...LEGACY_KEYS]
  for (const key of keys) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const items = parseBulletinItems(JSON.parse(raw))
      if (key !== BULLETIN_STORAGE_KEY) saveBulletinItems(items)
      return items
    } catch {
      window.localStorage.setItem(`${key}-recovery`, raw)
    }
  }

  return []
}

export function saveBulletinItems(items: BulletinItem[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BULLETIN_STORAGE_KEY, JSON.stringify(items))
  announceDataChange('bulletin')
}

export function createBulletinItem(input: {
  title: string
  notes?: string
  priority: BulletinPriority
  dueDate?: string
  dueTime?: string
}): BulletinItem {
  const now = new Date().toISOString()
  return {
    id: makeId(),
    title: input.title.trim(),
    notes: input.notes?.trim() ?? '',
    priority: input.priority,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    dueDate: input.dueDate || null,
    dueTime: input.dueTime || null,
    completedAt: null,
    isPinned: false,
  }
}

export function getDueTimestamp(item: BulletinItem): number | null {
  if (!item.dueDate) return null
  const time = item.dueTime || '23:59'
  const timestamp = new Date(`${item.dueDate}T${time}:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isOverdue(item: BulletinItem, now = new Date()): boolean {
  const due = getDueTimestamp(item)
  return item.status === 'active' && due !== null && due < now.getTime()
}

export function isDueToday(item: BulletinItem, now = new Date()): boolean {
  if (!item.dueDate || item.status !== 'active') return false
  const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return item.dueDate === localDay
}

export function sortBulletinItems(items: BulletinItem[]): BulletinItem[] {
  return items.toSorted((left, right) => {
    if (left.status !== right.status) return left.status === 'active' ? -1 : 1
    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1
    const priorityDelta = PRIORITY_META[right.priority].weight - PRIORITY_META[left.priority].weight
    if (priorityDelta) return priorityDelta
    const leftDue = getDueTimestamp(left) ?? Number.POSITIVE_INFINITY
    const rightDue = getDueTimestamp(right) ?? Number.POSITIVE_INFINITY
    return leftDue - rightDue || right.updatedAt.localeCompare(left.updatedAt)
  })
}
