export type MonthKey = `${number}-${number}`

export interface MonthPlan {
  monthKey: MonthKey
  startingAmountCents: number
  bucketAllocations: Record<string, number>
  manualRollovers: Record<string, number>
}

export interface Bucket {
  id: string
  name: string
  color: string
  archived: boolean
}

export interface Expense {
  id: string
  monthKey: MonthKey
  bucketId: string
  amountCents: number
  date: string
  note: string
  source: 'manual' | 'recurring_bill'
  createdAt: string
  updatedAt: string
}

export interface IncomeEntry {
  id: string
  monthKey: MonthKey
  amountCents: number
  date: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface RecurringBill {
  id: string
  name: string
  amountCents: number
  bucketId: string
  dueDay: number
  active: boolean
}

export interface RecurringBillMonthState {
  billId: string
  monthKey: MonthKey
  status: 'unpaid' | 'paid'
  paidExpenseId?: string
}

export interface BudgetData {
  version: number
  buckets: Bucket[]
  monthPlans: MonthPlan[]
  incomes: IncomeEntry[]
  expenses: Expense[]
  recurringBills: RecurringBill[]
  billMonthStates: RecurringBillMonthState[]
  reminderSettings: ReminderSettings
  reminderState: ReminderState
}

export interface ReminderSettings {
  remindersEnabled: boolean
  browserNotificationsEnabled: boolean
  remindDaysBefore: 0 | 1 | 3 | 7
}

export interface ReminderState {
  dismissedDayByReminder: Record<string, string>
  notifiedDayByReminder: Record<string, string>
  setupCompleted: boolean
}

export interface BucketSummary {
  bucket: Bucket
  allocatedCents: number
  spentCents: number
  remainingCents: number
}

export interface BillSummary {
  bill: RecurringBill
  state: RecurringBillMonthState['status']
}

export interface MonthSnapshot {
  monthKey: MonthKey
  monthPlan: MonthPlan
  incomes: IncomeEntry[]
  expenses: Expense[]
  bucketSummaries: BucketSummary[]
  billSummaries: BillSummary[]
  totalIncomeCents: number
  totalSpentCents: number
  requiredSpendCents: number
  outstandingRequiredCents: number
  availableRemainingCents: number
}

export interface UpcomingReminder {
  id: string
  bill: RecurringBill
  monthKey: MonthKey
  dueDate: string
  dueLabel: string
  daysUntilDue: number
}
