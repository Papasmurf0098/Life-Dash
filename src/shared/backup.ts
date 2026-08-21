import { loadBulletinItems, parseBulletinItems, saveBulletinItems } from '../features/bulletin/bulletin'
import { loadBudgetData, saveBudgetData } from '../features/budget/storage'
import { buildExportPayload, parseBudgetData } from '../features/budget/budget'
import { loadShiftEntries, parseShiftEntries, saveShiftEntries } from '../features/tips/tips'

export const LIFE_DASH_BACKUP_VERSION = 1

interface LifeDashBackup {
  app: 'life-dash'
  version: number
  exportedAt: string
  modules: {
    bulletin: unknown
    tips: unknown
    budget: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function buildLifeDashBackup(): string {
  const payload: LifeDashBackup = {
    app: 'life-dash',
    version: LIFE_DASH_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    modules: {
      bulletin: loadBulletinItems(),
      tips: loadShiftEntries(),
      budget: JSON.parse(buildExportPayload(loadBudgetData())) as unknown,
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function restoreLifeDashBackup(raw: unknown): void {
  if (!isRecord(raw) || raw.app !== 'life-dash' || raw.version !== LIFE_DASH_BACKUP_VERSION || !isRecord(raw.modules)) {
    throw new Error('This is not a compatible Life Dash backup.')
  }

  const bulletin = parseBulletinItems(raw.modules.bulletin)
  const tips = parseShiftEntries(raw.modules.tips)
  const budget = parseBudgetData(raw.modules.budget)

  saveBulletinItems(bulletin)
  saveShiftEntries(tips)
  saveBudgetData(budget)
}

export function downloadLifeDashBackup(): void {
  const blob = new Blob([buildLifeDashBackup()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `life-dash-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
