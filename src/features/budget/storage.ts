import { STORAGE_KEY } from './constants'
import { buildExportPayload, createInitialBudgetData, getCurrentMonthKey, parseBudgetData } from './budget'
import type { BudgetData } from './types'
import { announceDataChange } from '../../shared/events'

export function loadBudgetData(): BudgetData {
  const fallback = createInitialBudgetData()

  if (typeof window === 'undefined') {
    return fallback
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return fallback
  }

  try {
    const parsed = parseBudgetData(JSON.parse(raw))

    if (!parsed.monthPlans.some((plan) => plan.monthKey === getCurrentMonthKey())) {
      return {
        ...parsed,
        monthPlans: [...parsed.monthPlans, fallback.monthPlans[0]],
      }
    }

    return parsed
  } catch {
    window.localStorage.setItem(`${STORAGE_KEY}-recovery`, raw)
    return fallback
  }
}

export function saveBudgetData(data: BudgetData): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, buildExportPayload(data))
  announceDataChange('budget')
}

export async function readImportedBudgetFile(file: File): Promise<BudgetData> {
  const text = await file.text()
  return parseBudgetData(JSON.parse(text))
}
