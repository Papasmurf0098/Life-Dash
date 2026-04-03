import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { parseBudgetData } from './budget'
import * as storage from './storage'
import type { BudgetData } from './types'

describe('App', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('updates totals when adding an expense', async () => {
    const user = userEvent.setup()
    render(<App />)

    const startingAmount = screen.getByLabelText(/expected monthly income/i)
    await user.clear(startingAmount)
    await user.type(startingAmount, '1000')

    await user.selectOptions(screen.getByLabelText(/expense bucket/i), 'food')
    await user.type(screen.getByLabelText(/expense amount/i), '50')
    await user.type(screen.getByLabelText(/expense note/i), 'Groceries')
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    expect(screen.getAllByText('$950').length).toBeGreaterThan(0)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/expense added/i)
  })

  it('tracks actual money earned from income entries', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getAllByLabelText(/income amount/i)[0], '1200')
    await user.type(screen.getAllByLabelText(/income note/i)[0], 'Paycheck')
    await user.click(screen.getAllByRole('button', { name: /add income/i })[0])

    expect(screen.getByText('Paycheck')).toBeInTheDocument()
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0)
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent?.match(/earned total updated/i)),
    ).toBe(true)
  })

  it('adds a recurring bill and marks it paid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getAllByLabelText(/^bill name$/i)[0], 'Internet')
    await user.type(screen.getAllByLabelText(/^bill amount$/i)[0], '75')
    await user.clear(screen.getAllByLabelText(/bill due day/i)[0])
    await user.type(screen.getAllByLabelText(/bill due day/i)[0], '5')
    await user.click(screen.getAllByRole('button', { name: /add bill/i })[0])

    expect(screen.getByText('Internet')).toBeInTheDocument()
    expect(screen.getAllByText('$75').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /mark paid/i }))

    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent?.match(/added to expenses/i)),
    ).toBe(true)
  })

  it('imports a valid export file', async () => {
    render(<App />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const importedData = parseBudgetData({
      version: 2,
      buckets: [{ id: 'food', name: 'Food', color: '#ff7a59', archived: false }],
      monthPlans: [],
      incomes: [],
      expenses: [],
      recurringBills: [],
      billMonthStates: [],
    })
    const file = new File(['{}'], 'budget.json', { type: 'application/json' })
    vi.spyOn(storage, 'readImportedBudgetFile').mockResolvedValue(importedData as BudgetData)

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() =>
      expect(
        screen
          .getAllByRole('status')
          .some((node) => node.textContent?.match(/budget imported successfully/i)),
      ).toBe(true),
    )
  })

  it('shows a reminder banner for a recurring bill inside the current reminder window', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    vi.spyOn(storage, 'loadBudgetData').mockReturnValue(
      parseBudgetData({
        version: 2,
        buckets: [{ id: 'utilities', name: 'Utilities', color: '#ff7a59', archived: false }],
        monthPlans: [],
        incomes: [],
        expenses: [],
        recurringBills: [
          {
            id: 'bill-1',
            name: 'Internet',
            amountCents: 75_00,
            bucketId: 'utilities',
            dueDay: tomorrow.getDate(),
            active: true,
          },
        ],
        billMonthStates: [],
        reminderSettings: {
          remindersEnabled: true,
          browserNotificationsEnabled: false,
          remindDaysBefore: 1,
        },
        reminderState: {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: true,
        },
      }),
    )

    render(<App />)

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /dismiss internet reminder for today/i })[0],
      ).toBeInTheDocument(),
    )
  })

  it('hides the reminder panel after preferences are chosen and no reminders are active', async () => {
    const user = userEvent.setup()

    vi.spyOn(storage, 'loadBudgetData').mockReturnValue(
      parseBudgetData({
        version: 2,
        buckets: [{ id: 'utilities', name: 'Utilities', color: '#ff7a59', archived: false }],
        monthPlans: [],
        incomes: [],
        expenses: [],
        recurringBills: [],
        billMonthStates: [],
        reminderSettings: {
          remindersEnabled: true,
          browserNotificationsEnabled: false,
          remindDaysBefore: 1,
        },
        reminderState: {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: false,
        },
      }),
    )

    render(<App />)

    expect(screen.getAllByText(/keep upcoming bills in view/i).length).toBeGreaterThan(0)
    await user.selectOptions(screen.getAllByLabelText(/reminder timing/i)[0], '3')

    await waitFor(() =>
      expect(screen.queryAllByText(/keep upcoming bills in view/i)).toHaveLength(0),
    )
    expect(screen.getByRole('button', { name: /reminder settings/i })).toBeInTheDocument()
  })

  it('reopens reminder settings from the header when the panel is hidden', async () => {
    const user = userEvent.setup()

    vi.spyOn(storage, 'loadBudgetData').mockReturnValue(
      parseBudgetData({
        version: 2,
        buckets: [{ id: 'utilities', name: 'Utilities', color: '#ff7a59', archived: false }],
        monthPlans: [],
        incomes: [],
        expenses: [],
        recurringBills: [],
        billMonthStates: [],
        reminderSettings: {
          remindersEnabled: true,
          browserNotificationsEnabled: false,
          remindDaysBefore: 3,
        },
        reminderState: {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: true,
        },
      }),
    )

    render(<App />)

    expect(screen.queryAllByText(/keep upcoming bills in view/i)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /reminder settings/i }))
    expect(screen.getAllByText(/keep upcoming bills in view/i).length).toBeGreaterThan(0)
  })

  it('falls back to in-app reminders when notification permission is denied', async () => {
    const user = userEvent.setup()
    const requestPermission = vi.fn().mockResolvedValue('denied')
    const notificationMock = {
      permission: 'default',
      requestPermission,
    }
    vi.stubGlobal('Notification', notificationMock)
    const today = new Date()

    vi.spyOn(storage, 'loadBudgetData').mockReturnValue(
      parseBudgetData({
        version: 2,
        buckets: [{ id: 'utilities', name: 'Utilities', color: '#ff7a59', archived: false }],
        monthPlans: [],
        incomes: [],
        expenses: [],
        recurringBills: [
          {
            id: 'bill-1',
            name: 'Internet',
            amountCents: 75_00,
            bucketId: 'utilities',
            dueDay: today.getDate(),
            active: true,
          },
        ],
        billMonthStates: [],
        reminderSettings: {
          remindersEnabled: true,
          browserNotificationsEnabled: false,
          remindDaysBefore: 1,
        },
        reminderState: {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: false,
        },
      }),
    )

    render(<App />)
    await user.click(screen.getByRole('button', { name: /enable browser notifications/i }))

    expect(requestPermission).toHaveBeenCalled()
    expect(screen.getByText(/notifications are blocked/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /dismiss internet reminder for today/i })[0],
    ).toBeInTheDocument()
  })

  it('dismisses a reminder for the rest of the current day', async () => {
    const user = userEvent.setup()
    const today = new Date()

    vi.spyOn(storage, 'loadBudgetData').mockReturnValue(
      parseBudgetData({
        version: 2,
        buckets: [{ id: 'utilities', name: 'Utilities', color: '#ff7a59', archived: false }],
        monthPlans: [],
        incomes: [],
        expenses: [],
        recurringBills: [
          {
            id: 'bill-1',
            name: 'Internet',
            amountCents: 75_00,
            bucketId: 'utilities',
            dueDay: today.getDate(),
            active: true,
          },
        ],
        billMonthStates: [],
        reminderSettings: {
          remindersEnabled: true,
          browserNotificationsEnabled: false,
          remindDaysBefore: 1,
        },
        reminderState: {
          dismissedDayByReminder: {},
          notifiedDayByReminder: {},
          setupCompleted: true,
        },
      }),
    )

    render(<App />)
    await user.click(screen.getAllByRole('button', { name: /dismiss internet reminder for today/i })[0])

    await waitFor(() =>
      expect(screen.queryAllByText(/keep upcoming bills in view/i)).toHaveLength(0),
    )
    expect(screen.getByRole('button', { name: /reminder settings/i })).toBeInTheDocument()
  })
})
