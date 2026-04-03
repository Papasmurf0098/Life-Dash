import { describe, expect, it } from 'vitest'
import {
  addBucket,
  addExpense,
  addIncome,
  addRecurringBill,
  completeReminderSetup,
  createInitialBudgetData,
  deriveUpcomingReminders,
  dismissReminderForDay,
  deriveMonthSnapshot,
  parseBudgetData,
  setBucketAllocation,
  setStartingAmount,
  toggleRecurringBillPaid,
  updateReminderSettings,
} from './budget'

describe('budget calculations', () => {
  it('subtracts an expense from its bucket and monthly balance', () => {
    let data = createInitialBudgetData('2026-04')
    data = setStartingAmount(data, '2026-04', 500_00)
    data = setBucketAllocation(data, '2026-04', 'food', 200_00)
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'food',
      amountCents: 42_50,
      date: '2026-04-02',
      note: 'Groceries',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')
    const foodBucket = snapshot.bucketSummaries.find((bucket) => bucket.bucket.id === 'food')

    expect(snapshot.totalSpentCents).toBe(42_50)
    expect(snapshot.availableRemainingCents).toBe(457_50)
    expect(foodBucket?.remainingCents).toBe(157_50)
  })

  it('tracks recorded income separately from the expected monthly income plan', () => {
    let data = createInitialBudgetData('2026-04')
    data = setStartingAmount(data, '2026-04', 1_000_00)
    data = addIncome(data, {
      monthKey: '2026-04',
      amountCents: 900_00,
      date: '2026-04-01',
      note: 'Paycheck',
    })
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'food',
      amountCents: 50_00,
      date: '2026-04-02',
      note: 'Groceries',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')

    expect(snapshot.totalIncomeCents).toBe(900_00)
    expect(snapshot.availableRemainingCents).toBe(950_00)
  })

  it('calculates recurring bills and prevents duplicate paid entries', () => {
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Internet',
      amountCents: 65_00,
      bucketId: 'utilities',
      dueDay: 4,
    })

    const billId = data.recurringBills[0].id
    data = toggleRecurringBillPaid(data, billId, '2026-04')
    data = toggleRecurringBillPaid(data, billId, '2026-04')
    data = toggleRecurringBillPaid(data, billId, '2026-04')

    const snapshot = deriveMonthSnapshot(data, '2026-04')

    expect(snapshot.requiredSpendCents).toBe(65_00)
    expect(snapshot.totalSpentCents).toBe(65_00)
    expect(snapshot.expenses).toHaveLength(1)
    expect(snapshot.billSummaries[0]?.state).toBe('paid')
  })

  it('ignores legacy manual rollover values when deriving bucket remaining', () => {
    let data = createInitialBudgetData('2026-04')
    data = setBucketAllocation(data, '2026-04', 'shopping', 150_00)
    data = {
      ...data,
      monthPlans: data.monthPlans.map((plan) =>
        plan.monthKey === '2026-04'
          ? {
              ...plan,
              manualRollovers: { shopping: 25_00 },
            }
          : plan,
      ),
    }
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'shopping',
      amountCents: 40_00,
      date: '2026-04-10',
      note: 'Shoes',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')
    const shoppingBucket = snapshot.bucketSummaries.find((bucket) => bucket.bucket.id === 'shopping')

    expect(shoppingBucket?.remainingCents).toBe(110_00)
  })

  it('validates imported data version and shape', () => {
    const exported = {
      version: 2,
      buckets: [{ id: 'food', name: 'Food', color: '#ff7a59', archived: false }],
      monthPlans: [],
      incomes: [],
      expenses: [],
      recurringBills: [],
      billMonthStates: [],
    }

    expect(parseBudgetData(exported).buckets).toHaveLength(1)
    expect(parseBudgetData(exported).reminderState.setupCompleted).toBe(false)
    expect(parseBudgetData({ ...exported, version: 1 }).incomes).toHaveLength(0)
    expect(() => parseBudgetData({ ...exported, version: 999 })).toThrow(/Expected version 2/)
    expect(() => parseBudgetData({ version: 2, buckets: [] })).toThrow(/include any buckets/)
  })

  it('marks reminder setup complete without disturbing existing reminder state', () => {
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Internet',
      amountCents: 70_00,
      bucketId: 'utilities',
      dueDay: 10,
    })
    const reminderId = deriveUpcomingReminders(data, new Date('2026-04-10T12:00:00'))[0]?.id
    data = dismissReminderForDay(data, reminderId!, '2026-04-10')
    data = completeReminderSetup(data)

    expect(data.reminderState.setupCompleted).toBe(true)
    expect(data.reminderState.dismissedDayByReminder[reminderId!]).toBe('2026-04-10')
  })

  it('creates custom buckets', () => {
    const data = addBucket(createInitialBudgetData('2026-04'), {
      name: 'Travel',
      color: '#0f9db6',
    })

    expect(data.buckets.some((bucket) => bucket.name === 'Travel')).toBe(true)
  })

  it('derives a reminder for a bill due tomorrow when the window is one day', () => {
    const now = new Date('2026-04-10T12:00:00')
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Internet',
      amountCents: 70_00,
      bucketId: 'utilities',
      dueDay: 11,
    })

    const reminders = deriveUpcomingReminders(data, now)

    expect(reminders).toHaveLength(1)
    expect(reminders[0]?.daysUntilDue).toBe(1)
  })

  it('respects a three-day reminder window and skips dates outside it', () => {
    const now = new Date('2026-04-10T12:00:00')
    let data = createInitialBudgetData('2026-04')
    data = updateReminderSettings(data, { remindDaysBefore: 3 })
    data = addRecurringBill(data, {
      name: 'Phone',
      amountCents: 45_00,
      bucketId: 'utilities',
      dueDay: 13,
    })
    data = addRecurringBill(data, {
      name: 'Rent',
      amountCents: 900_00,
      bucketId: 'housing',
      dueDay: 15,
    })

    const reminders = deriveUpcomingReminders(data, now)

    expect(reminders.map((reminder) => reminder.bill.name)).toEqual(['Phone'])
  })

  it('does not remind for paid or inactive recurring bills', () => {
    const now = new Date('2026-04-10T12:00:00')
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Water',
      amountCents: 30_00,
      bucketId: 'utilities',
      dueDay: 10,
    })
    data = addRecurringBill(data, {
      name: 'Gym',
      amountCents: 25_00,
      bucketId: 'life',
      dueDay: 10,
    })
    const [waterBillId, gymBillId] = data.recurringBills.map((bill) => bill.id)
    data = toggleRecurringBillPaid(data, waterBillId, '2026-04')
    data = {
      ...data,
      recurringBills: data.recurringBills.map((bill) =>
        bill.id === gymBillId ? { ...bill, active: false } : bill,
      ),
    }

    const reminders = deriveUpcomingReminders(data, now)

    expect(reminders).toHaveLength(0)
  })

  it('carries reminders into the next month when the current month due date already passed', () => {
    const now = new Date('2026-04-30T12:00:00')
    let data = createInitialBudgetData('2026-04')
    data = updateReminderSettings(data, { remindDaysBefore: 3 })
    data = addRecurringBill(data, {
      name: 'Insurance',
      amountCents: 120_00,
      bucketId: 'life',
      dueDay: 2,
    })

    const reminders = deriveUpcomingReminders(data, now)

    expect(reminders).toHaveLength(1)
    expect(reminders[0]?.monthKey).toBe('2026-05')
    expect(reminders[0]?.daysUntilDue).toBe(2)
  })

  it('suppresses reminders that were dismissed for the current day', () => {
    const now = new Date('2026-04-10T12:00:00')
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Internet',
      amountCents: 70_00,
      bucketId: 'utilities',
      dueDay: 10,
    })

    const firstReminder = deriveUpcomingReminders(data, now)[0]
    data = dismissReminderForDay(data, firstReminder.id, '2026-04-10')

    expect(deriveUpcomingReminders(data, now)).toHaveLength(0)
  })
})
