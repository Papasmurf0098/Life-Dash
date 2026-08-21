import { describe, expect, it } from 'vitest'
import {
  aggregateShifts,
  FOOD_TIP_OUT_RATE,
  HOURLY_WAGE,
  LIQUOR_TIP_OUT_RATE,
  normalizeShift,
  saveShiftEntries,
  TIP_STORAGE_KEY,
} from './tips'

describe('shift earnings projection', () => {
  it('calculates $12 hourly base, 2% food tip-out, and 8% liquor tip-out', () => {
    const shift = normalizeShift({
      id: 'shift-1',
      date: '2026-08-20',
      section: 'patio',
      hours: 6.5,
      tips: 225,
      foodSales: 1000,
      liquorSales: 250,
      basePay: 999,
    })

    expect(HOURLY_WAGE).toBe(12)
    expect(FOOD_TIP_OUT_RATE).toBe(0.02)
    expect(LIQUOR_TIP_OUT_RATE).toBe(0.08)
    expect(shift).toMatchObject({
      section: 'Patio',
      basePay: 78,
      foodTipOut: 20,
      liquorTipOut: 20,
      tipOut: 40,
      netTips: 185,
      projectedEarnings: 263,
    })
  })

  it('keeps sales optional and recalculates legacy manual base pay', () => {
    const shift = normalizeShift({
      id: 'legacy',
      date: '2026-08-20',
      section: 'bar',
      hours: 5,
      tips: 180,
      basePay: 12,
    })

    expect(shift).toMatchObject({
      basePay: 60,
      foodSales: null,
      liquorSales: null,
      tipOut: 0,
      projectedEarnings: 240,
    })
  })

  it('aggregates projected earnings without turning them into take-home income', () => {
    const entries = [
      normalizeShift({ date: '2026-08-20', section: 'Patio', hours: 5, tips: 150 }),
      normalizeShift({ date: '2026-08-21', section: 'Patio', hours: 4, tips: 140, foodSales: 500, liquorSales: 100 }),
    ].filter((entry) => entry !== null)

    expect(aggregateShifts(entries)).toMatchObject({
      shifts: 2,
      hours: 9,
      basePay: 108,
      foodTipOut: 10,
      liquorTipOut: 8,
      tipOut: 18,
      projectedEarnings: 380,
    })
  })

  it('stores shift projections separately from the take-home budget', () => {
    window.localStorage.clear()
    window.localStorage.setItem('budget-app-data-v2', 'take-home-sentinel')
    const shift = normalizeShift({
      date: '2026-08-20',
      section: 'Bar',
      hours: 5,
      tips: 180,
      liquorSales: 200,
    })

    saveShiftEntries(shift ? [shift] : [])

    expect(window.localStorage.getItem(TIP_STORAGE_KEY)).toContain('projectedEarnings')
    expect(window.localStorage.getItem('budget-app-data-v2')).toBe('take-home-sentinel')
  })
})
