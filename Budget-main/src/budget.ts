import { BUCKET_COLORS, DATA_VERSION, STARTER_BUCKETS } from './constants'
import type {
  BillSummary,
  BudgetData,
  Bucket,
  BucketSummary,
  Expense,
  IncomeEntry,
  MonthKey,
  MonthPlan,
  MonthSnapshot,
  RecurringBill,
  RecurringBillMonthState,
  ReminderSettings,
  UpcomingReminder,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const reminderDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

export function createDefaultReminderSettings(): ReminderSettings {
  return {
    remindersEnabled: true,
    browserNotificationsEnabled: false,
    remindDaysBefore: 1,
  }
}

export function createInitialBudgetData(monthKey = getCurrentMonthKey()): BudgetData {
  return {
    version: DATA_VERSION,
    buckets: STARTER_BUCKETS,
    monthPlans: [createEmptyMonthPlan(monthKey)],
    incomes: [],
    expenses: [],
    recurringBills: [],
    billMonthStates: [],
    reminderSettings: createDefaultReminderSettings(),
    reminderState: {
      dismissedDayByReminder: {},
      notifiedDayByReminder: {},
      setupCompleted: false,
    },
  }
}

export function createEmptyMonthPlan(monthKey: MonthKey): MonthPlan {
  return {
    monthKey,
    startingAmountCents: 0,
    bucketAllocations: {},
    manualRollovers: {},
  }
}

export function getCurrentMonthKey(date = new Date()): MonthKey {
  return date.toISOString().slice(0, 7) as MonthKey
}

export function createMonthDate(monthKey: MonthKey, day: number): string {
  const safeDay = String(Math.min(28, Math.max(1, day))).padStart(2, '0')
  return `${monthKey}-${safeDay}`
}

export function getMonthLabel(monthKey: MonthKey): string {
  return monthLabelFormatter.format(new Date(`${monthKey}-01T12:00:00`))
}

export function getCurrentLocalDayKey(date = new Date()): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMonthPlan(data: BudgetData, monthKey: MonthKey): MonthPlan {
  return data.monthPlans.find((plan) => plan.monthKey === monthKey) ?? createEmptyMonthPlan(monthKey)
}

export function getMonthOptions(data: BudgetData): MonthKey[] {
  const monthSet = new Set<MonthKey>([getCurrentMonthKey()])

  data.monthPlans.forEach((plan) => monthSet.add(plan.monthKey))
  data.incomes.forEach((income) => monthSet.add(income.monthKey))
  data.expenses.forEach((expense) => monthSet.add(expense.monthKey))
  data.billMonthStates.forEach((state) => monthSet.add(state.monthKey))

  return Array.from(monthSet).toSorted((left, right) => right.localeCompare(left)) as MonthKey[]
}

export function getDefaultBucketId(data: BudgetData): string {
  return data.buckets.find((bucket) => !bucket.archived)?.id ?? data.buckets[0]?.id ?? 'housing'
}

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

export function formatCurrencyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

export function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, '')

  if (!normalized) {
    return null
  }

  const amount = Number(normalized)

  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }

  return Math.round(amount * 100)
}

export function deriveMonthSnapshot(data: BudgetData, monthKey: MonthKey): MonthSnapshot {
  const monthPlan = getMonthPlan(data, monthKey)
  const incomes = data.incomes
    .filter((income) => income.monthKey === monthKey)
    .toSorted((left, right) => right.date.localeCompare(left.date))
  const expenses = data.expenses
    .filter((expense) => expense.monthKey === monthKey)
    .toSorted((left, right) => right.date.localeCompare(left.date))

  const totalIncomeCents = incomes.reduce((total, income) => total + income.amountCents, 0)
  const spentByBucket = new Map<string, number>()
  let totalSpentCents = 0

  expenses.forEach((expense) => {
    totalSpentCents += expense.amountCents
    spentByBucket.set(
      expense.bucketId,
      (spentByBucket.get(expense.bucketId) ?? 0) + expense.amountCents,
    )
  })

  const bucketLookup = new Map(data.buckets.map((bucket) => [bucket.id, bucket]))
  const activeBills = data.recurringBills.filter((bill) => bill.active)
  const billSummaries: BillSummary[] = activeBills
    .map((bill) => {
      const state =
        data.billMonthStates.find(
          (entry) => entry.billId === bill.id && entry.monthKey === monthKey,
        )?.status ?? 'unpaid'

      return { bill, state }
    })
    .toSorted((left, right) => left.bill.dueDay - right.bill.dueDay || left.bill.name.localeCompare(right.bill.name))

  const requiredSpendCents = billSummaries.reduce(
    (total, summary) => total + summary.bill.amountCents,
    0,
  )
  const outstandingRequiredCents = billSummaries
    .filter((summary) => summary.state === 'unpaid')
    .reduce((total, summary) => total + summary.bill.amountCents, 0)

  const bucketIds = new Set<string>([
    ...data.buckets.map((bucket) => bucket.id),
    ...Object.keys(monthPlan.bucketAllocations),
    ...expenses.map((expense) => expense.bucketId),
    ...activeBills.map((bill) => bill.bucketId),
  ])

  const bucketSummaries: BucketSummary[] = Array.from(bucketIds)
    .map((bucketId) => {
      const bucket =
        bucketLookup.get(bucketId) ??
        {
          id: bucketId,
          name: 'Unknown bucket',
          color: BUCKET_COLORS[0],
          archived: true,
        }

      const allocatedCents = monthPlan.bucketAllocations[bucketId] ?? 0
      const spentCents = spentByBucket.get(bucketId) ?? 0

      return {
        bucket,
        allocatedCents,
        spentCents,
        remainingCents: allocatedCents - spentCents,
      }
    })
    .toSorted((left, right) => {
      if (left.bucket.archived !== right.bucket.archived) {
        return Number(left.bucket.archived) - Number(right.bucket.archived)
      }

      return left.bucket.name.localeCompare(right.bucket.name)
    })

  return {
    monthKey,
    monthPlan,
    incomes,
    expenses,
    bucketSummaries,
    billSummaries,
    totalIncomeCents,
    totalSpentCents,
    requiredSpendCents,
    outstandingRequiredCents,
    availableRemainingCents: monthPlan.startingAmountCents - totalSpentCents,
  }
}

function upsertMonthPlan(data: BudgetData, nextPlan: MonthPlan): BudgetData {
  const existingIndex = data.monthPlans.findIndex((plan) => plan.monthKey === nextPlan.monthKey)

  if (existingIndex === -1) {
    return { ...data, monthPlans: [...data.monthPlans, nextPlan] }
  }

  return {
    ...data,
    monthPlans: data.monthPlans.map((plan, index) => (index === existingIndex ? nextPlan : plan)),
  }
}

export function setStartingAmount(
  data: BudgetData,
  monthKey: MonthKey,
  startingAmountCents: number,
): BudgetData {
  const monthPlan = getMonthPlan(data, monthKey)

  return upsertMonthPlan(data, {
    ...monthPlan,
    startingAmountCents,
  })
}

export function updateReminderSettings(
  data: BudgetData,
  patch: Partial<ReminderSettings>,
): BudgetData {
  return {
    ...data,
    reminderSettings: {
      ...data.reminderSettings,
      ...patch,
    },
  }
}

export function dismissReminderForDay(
  data: BudgetData,
  reminderId: string,
  dayKey: string,
): BudgetData {
  return {
    ...data,
    reminderState: {
      ...data.reminderState,
      dismissedDayByReminder: {
        ...data.reminderState.dismissedDayByReminder,
        [reminderId]: dayKey,
      },
    },
  }
}

export function markReminderNotified(
  data: BudgetData,
  reminderId: string,
  dayKey: string,
): BudgetData {
  return {
    ...data,
    reminderState: {
      ...data.reminderState,
      notifiedDayByReminder: {
        ...data.reminderState.notifiedDayByReminder,
        [reminderId]: dayKey,
      },
    },
  }
}

export function completeReminderSetup(data: BudgetData): BudgetData {
  if (data.reminderState.setupCompleted) {
    return data
  }

  return {
    ...data,
    reminderState: {
      ...data.reminderState,
      setupCompleted: true,
    },
  }
}

export function setBucketAllocation(
  data: BudgetData,
  monthKey: MonthKey,
  bucketId: string,
  amountCents: number,
): BudgetData {
  const monthPlan = getMonthPlan(data, monthKey)

  return upsertMonthPlan(data, {
    ...monthPlan,
    bucketAllocations: {
      ...monthPlan.bucketAllocations,
      [bucketId]: amountCents,
    },
  })
}

export function setBucketRollover(
  data: BudgetData,
  monthKey: MonthKey,
  bucketId: string,
  amountCents: number,
): BudgetData {
  const monthPlan = getMonthPlan(data, monthKey)

  return upsertMonthPlan(data, {
    ...monthPlan,
    manualRollovers: {
      ...monthPlan.manualRollovers,
      [bucketId]: amountCents,
    },
  })
}

export function addBucket(data: BudgetData, input: Pick<Bucket, 'name' | 'color'>): BudgetData {
  const bucket: Bucket = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    color: input.color,
    archived: false,
  }

  return {
    ...data,
    buckets: [...data.buckets, bucket],
  }
}

export function updateBucket(
  data: BudgetData,
  bucketId: string,
  patch: Partial<Pick<Bucket, 'name' | 'color' | 'archived'>>,
): BudgetData {
  return {
    ...data,
    buckets: data.buckets.map((bucket) =>
      bucket.id === bucketId
        ? {
            ...bucket,
            ...patch,
            name: patch.name?.trim() ?? bucket.name,
          }
        : bucket,
    ),
  }
}

export function archiveBucket(data: BudgetData, bucketId: string): BudgetData {
  const hasReferences =
    data.expenses.some((expense) => expense.bucketId === bucketId) ||
    data.recurringBills.some((bill) => bill.bucketId === bucketId)

  if (hasReferences) {
    return updateBucket(data, bucketId, { archived: true })
  }

  return {
    ...data,
    buckets: data.buckets.filter((bucket) => bucket.id !== bucketId),
    monthPlans: data.monthPlans.map((plan) => {
      const { [bucketId]: omittedAllocation, ...bucketAllocations } = plan.bucketAllocations
      const { [bucketId]: omittedRollover, ...manualRollovers } = plan.manualRollovers
      void omittedAllocation
      void omittedRollover

      return {
        ...plan,
        bucketAllocations,
        manualRollovers,
      }
    }),
  }
}

export function addExpense(
  data: BudgetData,
  input: Pick<Expense, 'monthKey' | 'bucketId' | 'amountCents' | 'date' | 'note' | 'source'>,
): BudgetData {
  const now = new Date().toISOString()
  const expense: Expense = {
    id: crypto.randomUUID(),
    ...input,
    note: input.note.trim(),
    createdAt: now,
    updatedAt: now,
  }

  return {
    ...data,
    expenses: [expense, ...data.expenses],
  }
}

export function addIncome(
  data: BudgetData,
  input: Pick<IncomeEntry, 'monthKey' | 'amountCents' | 'date' | 'note'>,
): BudgetData {
  const now = new Date().toISOString()
  const income: IncomeEntry = {
    id: crypto.randomUUID(),
    ...input,
    note: input.note.trim(),
    createdAt: now,
    updatedAt: now,
  }

  return {
    ...data,
    incomes: [income, ...data.incomes],
  }
}

export function updateIncome(
  data: BudgetData,
  incomeId: string,
  patch: Partial<Pick<IncomeEntry, 'amountCents' | 'date' | 'note'>>,
): BudgetData {
  return {
    ...data,
    incomes: data.incomes.map((income) =>
      income.id === incomeId
        ? {
            ...income,
            ...patch,
            note: patch.note?.trim() ?? income.note,
            updatedAt: new Date().toISOString(),
          }
        : income,
    ),
  }
}

export function deleteIncome(data: BudgetData, incomeId: string): BudgetData {
  return {
    ...data,
    incomes: data.incomes.filter((income) => income.id !== incomeId),
  }
}

export function updateExpense(
  data: BudgetData,
  expenseId: string,
  patch: Partial<Pick<Expense, 'bucketId' | 'amountCents' | 'date' | 'note'>>,
): BudgetData {
  return {
    ...data,
    expenses: data.expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            ...patch,
            note: patch.note?.trim() ?? expense.note,
            updatedAt: new Date().toISOString(),
          }
        : expense,
    ),
  }
}

export function deleteExpense(data: BudgetData, expenseId: string): BudgetData {
  return {
    ...data,
    expenses: data.expenses.filter((expense) => expense.id !== expenseId),
    billMonthStates: data.billMonthStates.map((state) =>
      state.paidExpenseId === expenseId
        ? {
            ...state,
            status: 'unpaid',
            paidExpenseId: undefined,
          }
        : state,
    ),
  }
}

export function addRecurringBill(
  data: BudgetData,
  input: Pick<RecurringBill, 'name' | 'amountCents' | 'bucketId' | 'dueDay'>,
): BudgetData {
  const bill: RecurringBill = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    amountCents: input.amountCents,
    bucketId: input.bucketId,
    dueDay: input.dueDay,
    active: true,
  }

  return {
    ...data,
    recurringBills: [...data.recurringBills, bill],
  }
}

export function updateRecurringBill(
  data: BudgetData,
  billId: string,
  patch: Partial<Pick<RecurringBill, 'name' | 'amountCents' | 'bucketId' | 'dueDay' | 'active'>>,
): BudgetData {
  return {
    ...data,
    recurringBills: data.recurringBills.map((bill) =>
      bill.id === billId
        ? {
            ...bill,
            ...patch,
            name: patch.name?.trim() ?? bill.name,
          }
        : bill,
    ),
  }
}

function upsertBillMonthState(data: BudgetData, nextState: RecurringBillMonthState): BudgetData {
  const index = data.billMonthStates.findIndex(
    (state) => state.billId === nextState.billId && state.monthKey === nextState.monthKey,
  )

  if (index === -1) {
    return {
      ...data,
      billMonthStates: [...data.billMonthStates, nextState],
    }
  }

  return {
    ...data,
    billMonthStates: data.billMonthStates.map((state, stateIndex) =>
      stateIndex === index ? nextState : state,
    ),
  }
}

export function toggleRecurringBillPaid(
  data: BudgetData,
  billId: string,
  monthKey: MonthKey,
): BudgetData {
  const bill = data.recurringBills.find((entry) => entry.id === billId)

  if (!bill) {
    return data
  }

  const existingState =
    data.billMonthStates.find((state) => state.billId === billId && state.monthKey === monthKey) ??
    {
      billId,
      monthKey,
      status: 'unpaid' as const,
    }

  if (existingState.status === 'paid' && existingState.paidExpenseId) {
    const withoutExpense = deleteExpense(data, existingState.paidExpenseId)

    return upsertBillMonthState(withoutExpense, {
      billId,
      monthKey,
      status: 'unpaid',
    })
  }

  const paidExpenseId = existingState.paidExpenseId ?? crypto.randomUUID()
  const matchingExpense = data.expenses.find((expense) => expense.id === paidExpenseId)
  const now = new Date().toISOString()
  const syncedExpense: Expense = {
    id: paidExpenseId,
    monthKey,
    bucketId: bill.bucketId,
    amountCents: bill.amountCents,
    date: createMonthDate(monthKey, bill.dueDay),
    note: `${bill.name} bill`,
    source: 'recurring_bill',
    createdAt: matchingExpense?.createdAt ?? now,
    updatedAt: now,
  }

  const nextExpenses = matchingExpense
    ? data.expenses.map((expense) => (expense.id === paidExpenseId ? syncedExpense : expense))
    : [syncedExpense, ...data.expenses]

  return upsertBillMonthState(
    {
      ...data,
      expenses: nextExpenses,
    },
    {
      billId,
      monthKey,
      status: 'paid',
      paidExpenseId,
    },
  )
}

export function buildExportPayload(data: BudgetData): string {
  return JSON.stringify(
    {
      ...data,
      monthPlans: data.monthPlans.map((plan) => ({
        ...plan,
        manualRollovers: {},
      })),
    },
    null,
    2,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
}

function sanitizeNumericRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) =>
      typeof entryValue === 'number' && Number.isFinite(entryValue) ? [[key, Math.round(entryValue)]] : [],
    ),
  )
}

export function parseBudgetData(raw: unknown): BudgetData {
  if (!isRecord(raw)) {
    throw new Error('Import file is not a valid budget export.')
  }

  if (raw.version !== 1 && raw.version !== DATA_VERSION) {
    throw new Error(`This import is for version ${String(raw.version)}. Expected version ${DATA_VERSION}.`)
  }

  const buckets = Array.isArray(raw.buckets)
    ? raw.buckets.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          typeof entry.id !== 'string' ||
          typeof entry.name !== 'string' ||
          typeof entry.color !== 'string' ||
          typeof entry.archived !== 'boolean'
        ) {
          return []
        }

        return [
          {
            id: entry.id,
            name: entry.name.trim() || 'Untitled bucket',
            color: entry.color,
            archived: entry.archived,
          } satisfies Bucket,
        ]
      })
    : []

  const monthPlans = Array.isArray(raw.monthPlans)
    ? raw.monthPlans.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          !isMonthKey(entry.monthKey) ||
          typeof entry.startingAmountCents !== 'number'
        ) {
          return []
        }

        return [
          {
            monthKey: entry.monthKey,
            startingAmountCents: Math.round(entry.startingAmountCents),
            bucketAllocations: sanitizeNumericRecord(entry.bucketAllocations),
            manualRollovers: {},
          } satisfies MonthPlan,
        ]
      })
    : []

  const incomes = Array.isArray(raw.incomes)
    ? raw.incomes.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          typeof entry.id !== 'string' ||
          !isMonthKey(entry.monthKey) ||
          typeof entry.amountCents !== 'number' ||
          typeof entry.date !== 'string' ||
          typeof entry.note !== 'string' ||
          typeof entry.createdAt !== 'string' ||
          typeof entry.updatedAt !== 'string'
        ) {
          return []
        }

        return [
          {
            id: entry.id,
            monthKey: entry.monthKey,
            amountCents: Math.round(entry.amountCents),
            date: entry.date,
            note: entry.note,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          } satisfies IncomeEntry,
        ]
      })
    : []

  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          typeof entry.id !== 'string' ||
          !isMonthKey(entry.monthKey) ||
          typeof entry.bucketId !== 'string' ||
          typeof entry.amountCents !== 'number' ||
          typeof entry.date !== 'string' ||
          typeof entry.note !== 'string' ||
          (entry.source !== 'manual' && entry.source !== 'recurring_bill') ||
          typeof entry.createdAt !== 'string' ||
          typeof entry.updatedAt !== 'string'
        ) {
          return []
        }

        return [
          {
            id: entry.id,
            monthKey: entry.monthKey,
            bucketId: entry.bucketId,
            amountCents: Math.round(entry.amountCents),
            date: entry.date,
            note: entry.note,
            source: entry.source,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          } satisfies Expense,
        ]
      })
    : []

  const recurringBills = Array.isArray(raw.recurringBills)
    ? raw.recurringBills.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          typeof entry.id !== 'string' ||
          typeof entry.name !== 'string' ||
          typeof entry.amountCents !== 'number' ||
          typeof entry.bucketId !== 'string' ||
          typeof entry.dueDay !== 'number' ||
          typeof entry.active !== 'boolean'
        ) {
          return []
        }

        return [
          {
            id: entry.id,
            name: entry.name.trim() || 'Untitled bill',
            amountCents: Math.round(entry.amountCents),
            bucketId: entry.bucketId,
            dueDay: Math.min(31, Math.max(1, Math.round(entry.dueDay))),
            active: entry.active,
          } satisfies RecurringBill,
        ]
      })
    : []

  const billMonthStates = Array.isArray(raw.billMonthStates)
    ? raw.billMonthStates.flatMap((entry) => {
        if (
          !isRecord(entry) ||
          typeof entry.billId !== 'string' ||
          !isMonthKey(entry.monthKey) ||
          (entry.status !== 'paid' && entry.status !== 'unpaid')
        ) {
          return []
        }

        return [
          {
            billId: entry.billId,
            monthKey: entry.monthKey,
            status: entry.status,
            paidExpenseId:
              typeof entry.paidExpenseId === 'string' ? entry.paidExpenseId : undefined,
          } satisfies RecurringBillMonthState,
        ]
      })
    : []

  const reminderSettings =
    isRecord(raw.reminderSettings) &&
    typeof raw.reminderSettings.remindersEnabled === 'boolean' &&
    typeof raw.reminderSettings.browserNotificationsEnabled === 'boolean' &&
    (raw.reminderSettings.remindDaysBefore === 0 ||
      raw.reminderSettings.remindDaysBefore === 1 ||
      raw.reminderSettings.remindDaysBefore === 3 ||
      raw.reminderSettings.remindDaysBefore === 7)
      ? {
          remindersEnabled: raw.reminderSettings.remindersEnabled,
          browserNotificationsEnabled: raw.reminderSettings.browserNotificationsEnabled,
          remindDaysBefore: raw.reminderSettings.remindDaysBefore as ReminderSettings['remindDaysBefore'],
        }
      : createDefaultReminderSettings()

  const reminderState =
    isRecord(raw.reminderState)
      ? {
          dismissedDayByReminder: Object.fromEntries(
            Object.entries(isRecord(raw.reminderState.dismissedDayByReminder) ? raw.reminderState.dismissedDayByReminder : {}).flatMap(
              ([key, value]) => (typeof value === 'string' ? [[key, value]] : []),
            ),
          ),
          notifiedDayByReminder: Object.fromEntries(
            Object.entries(isRecord(raw.reminderState.notifiedDayByReminder) ? raw.reminderState.notifiedDayByReminder : {}).flatMap(
              ([key, value]) => (typeof value === 'string' ? [[key, value]] : []),
            ),
          ),
          setupCompleted: raw.reminderState.setupCompleted === true,
        }
      : {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: false,
        }

  if (!buckets.length) {
    throw new Error('Import file does not include any buckets.')
  }

  return {
    version: DATA_VERSION,
    buckets,
    monthPlans,
    incomes,
    expenses,
    recurringBills,
    billMonthStates,
    reminderSettings,
    reminderState,
  }
}

function getClampedDueDate(year: number, monthIndex: number, dueDay: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(lastDay, Math.max(1, dueDay)), 12)
}

function getLocalMonthKey(date: Date): MonthKey {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}` as MonthKey
}

function getDayStamp(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

export function deriveUpcomingReminders(
  data: BudgetData,
  now = new Date(),
): UpcomingReminder[] {
  if (!data.reminderSettings.remindersEnabled) {
    return []
  }

  const todayKey = getCurrentLocalDayKey(now)
  const todayStamp = getDayStamp(now)

  return data.recurringBills
    .filter((bill) => bill.active)
    .map((bill) => {
      const currentMonthDue = getClampedDueDate(now.getFullYear(), now.getMonth(), bill.dueDay)
      const dueDate =
        getDayStamp(currentMonthDue) >= todayStamp
          ? currentMonthDue
          : getClampedDueDate(now.getFullYear(), now.getMonth() + 1, bill.dueDay)
      const monthKey = getLocalMonthKey(dueDate)
      const reminderId = `${bill.id}:${monthKey}`
      const daysUntilDue = getDayStamp(dueDate) - todayStamp
      const isPaid =
        data.billMonthStates.find(
          (state) => state.billId === bill.id && state.monthKey === monthKey,
        )?.status === 'paid'
      const dismissedToday = data.reminderState.dismissedDayByReminder[reminderId] === todayKey

      return {
        id: reminderId,
        bill,
        monthKey,
        dueDate: dueDate.toISOString(),
        dueLabel: reminderDateFormatter.format(dueDate),
        daysUntilDue,
        isPaid,
        dismissedToday,
      }
    })
    .filter(
      (reminder) =>
        reminder.daysUntilDue >= 0 &&
        reminder.daysUntilDue <= data.reminderSettings.remindDaysBefore &&
        !reminder.isPaid &&
        !reminder.dismissedToday,
    )
    .map((reminder) => ({
      id: reminder.id,
      bill: reminder.bill,
      monthKey: reminder.monthKey,
      dueDate: reminder.dueDate,
      dueLabel: reminder.dueLabel,
      daysUntilDue: reminder.daysUntilDue,
    }))
    .toSorted(
      (left, right) =>
        left.daysUntilDue - right.daysUntilDue ||
        left.bill.dueDay - right.bill.dueDay ||
        left.bill.name.localeCompare(right.bill.name),
    )
}
