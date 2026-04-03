import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { BUCKET_COLORS } from './constants'
import {
  addBucket,
  addExpense,
  addIncome,
  addRecurringBill,
  archiveBucket,
  buildExportPayload,
  completeReminderSetup,
  createMonthDate,
  deriveUpcomingReminders,
  dismissReminderForDay,
  deleteExpense,
  deleteIncome,
  deriveMonthSnapshot,
  formatCurrency,
  formatCurrencyInput,
  getCurrentLocalDayKey,
  getCurrentMonthKey,
  getDefaultBucketId,
  getMonthLabel,
  getMonthOptions,
  markReminderNotified,
  parseCurrencyInput,
  setBucketAllocation,
  setStartingAmount,
  toggleRecurringBillPaid,
  updateReminderSettings,
  updateBucket,
  updateExpense,
  updateIncome,
  updateRecurringBill,
} from './budget'
import { loadBudgetData, readImportedBudgetFile, saveBudgetData } from './storage'
import type { Expense, IncomeEntry, MonthKey, RecurringBill } from './types'

interface IncomeDraft {
  amount: string
  date: string
  note: string
}

interface ExpenseDraft {
  bucketId: string
  amount: string
  date: string
  note: string
}

interface BillDraft {
  name: string
  amount: string
  bucketId: string
  dueDay: string
}

interface BucketDraft {
  name: string
  color: string
}

type ThemeMode = 'light' | 'dark'
type SectionKey = 'income' | 'expenses' | 'bills' | 'buckets'
type PanelGraphicKind = 'overview' | 'reminders' | SectionKey

const enterAnimation = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const sectionKeys: SectionKey[] = ['income', 'expenses', 'bills', 'buckets']
const reminderDayOptions = [0, 1, 3, 7] as const

function createGraphicAnimation({
  x = 0,
  y = 0,
  rotate = 0,
  scale = 1,
  duration,
  delay = 0,
}: {
  x?: number
  y?: number
  rotate?: number
  scale?: number
  duration: number
  delay?: number
}) {
  return {
    animate: {
      x: [0, x, 0],
      y: [0, y, 0],
      rotate: [0, rotate, 0],
      scale: [1, scale, 1],
    },
    transition: {
      duration,
      delay,
      repeat: Number.POSITIVE_INFINITY,
      repeatType: 'mirror' as const,
      ease: 'easeInOut' as const,
    },
  }
}

function buildExpenseDraft(bucketId: string, monthKey = getCurrentMonthKey()): ExpenseDraft {
  return {
    bucketId,
    amount: '',
    date: createMonthDate(monthKey, 1),
    note: '',
  }
}

function buildIncomeDraft(monthKey = getCurrentMonthKey()): IncomeDraft {
  return {
    amount: '',
    date: createMonthDate(monthKey, 1),
    note: '',
  }
}

function buildBillDraft(bucketId: string): BillDraft {
  return {
    name: '',
    amount: '',
    bucketId,
    dueDay: '1',
  }
}

function OverviewMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warning' | 'positive'
}) {
  return (
    <div className={`metric metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.localStorage.getItem('budget-theme') === 'dark' ? 'dark' : 'light'
}

function createSectionState(value: boolean): Record<SectionKey, boolean> {
  return {
    income: value,
    expenses: value,
    bills: value,
    buckets: value,
  }
}

function PanelGraphic({ kind }: { kind: PanelGraphicKind }) {
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = !prefersReducedMotion
  const drift = motionEnabled
    ? createGraphicAnimation({ x: -22, y: 8, rotate: -1.5, scale: 1.02, duration: 15.5 })
    : undefined
  const accentOne = motionEnabled
    ? createGraphicAnimation({ x: 10, y: -10, rotate: 4, scale: 1.06, duration: 7.2, delay: 0.2 })
    : undefined
  const accentTwo = motionEnabled
    ? createGraphicAnimation({ x: -8, y: 10, rotate: -5, scale: 0.96, duration: 8.6, delay: 0.5 })
    : undefined

  return (
    <div className={`panel-graphic panel-graphic--${kind}`} aria-hidden="true">
      <motion.div
        className="panel-graphic__watermark"
        animate={drift?.animate}
        transition={drift?.transition}
      />
      <motion.span
        className="panel-graphic__accent panel-graphic__accent--primary"
        animate={accentOne?.animate}
        transition={accentOne?.transition}
      />
      <motion.span
        className="panel-graphic__accent panel-graphic__accent--secondary"
        animate={accentTwo?.animate}
        transition={accentTwo?.transition}
      />
    </div>
  )
}

function SectionPanel({
  eyebrow,
  title,
  description,
  graphicKind,
  isOpen,
  onToggle,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  graphicKind: SectionKey
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <motion.section
      className="panel"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={enterAnimation}
      transition={{ duration: 0.4 }}
    >
      <PanelGraphic kind={graphicKind} />
      <div className="section-heading">
        <div className="section-heading__copy">
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p className="support-copy">{description}</p>
        </div>
        <button
          className="ghost-button section-toggle"
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? 'Collapse' : 'Open'}
        </button>
      </div>

      {isOpen ? <div className="section-content">{children}</div> : <p className="section-collapsed-note">Section collapsed.</p>}
    </motion.section>
  )
}

function App() {
  const [data, setData] = useState(loadBudgetData)
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(getCurrentMonthKey())
  const [message, setMessage] = useState('Budget saved locally on this device.')
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )
  const [showReminderSettings, setShowReminderSettings] = useState(false)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(
    createSectionState(true),
  )
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const defaultBucketId = getDefaultBucketId(data)
  const bucketOptions = data.buckets.filter((bucket) => !bucket.archived)
  const safeBucketOptions = bucketOptions.length ? bucketOptions : data.buckets
  const snapshot = deriveMonthSnapshot(data, selectedMonth)
  const monthOptions = getMonthOptions(data)
  const upcomingReminders = deriveUpcomingReminders(data)
  const reminderPanelVisible =
    showReminderSettings || upcomingReminders.length > 0 || !data.reminderState.setupCompleted

  const [incomeDraft, setIncomeDraft] = useState<IncomeDraft>(() => buildIncomeDraft())
  const [incomeEdits, setIncomeEdits] = useState<Record<string, IncomeDraft>>({})
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() =>
    buildExpenseDraft(defaultBucketId),
  )
  const [expenseEdits, setExpenseEdits] = useState<Record<string, ExpenseDraft>>({})
  const [billDraft, setBillDraft] = useState<BillDraft>(() => buildBillDraft(defaultBucketId))
  const [billEdits, setBillEdits] = useState<Record<string, BillDraft>>({})
  const [bucketDraft, setBucketDraft] = useState<BucketDraft>({
    name: '',
    color: BUCKET_COLORS[0],
  })

  useEffect(() => {
    saveBudgetData(data)
  }, [data])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('budget-theme', theme)
  }, [theme])

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      return
    }

    const refreshPermission = () => setNotificationPermission(Notification.permission)
    refreshPermission()

    document.addEventListener('visibilitychange', refreshPermission)
    window.addEventListener('focus', refreshPermission)

    return () => {
      document.removeEventListener('visibilitychange', refreshPermission)
      window.removeEventListener('focus', refreshPermission)
    }
  }, [])

  useEffect(() => {
    if (!safeBucketOptions.some((bucket) => bucket.id === expenseDraft.bucketId)) {
      setExpenseDraft((current) => ({ ...current, bucketId: defaultBucketId }))
    }

    if (!safeBucketOptions.some((bucket) => bucket.id === billDraft.bucketId)) {
      setBillDraft((current) => ({ ...current, bucketId: defaultBucketId }))
    }
  }, [billDraft.bucketId, defaultBucketId, expenseDraft.bucketId, safeBucketOptions])

  useEffect(() => {
    if (
      typeof Notification === 'undefined' ||
      notificationPermission !== 'granted' ||
      !data.reminderSettings.remindersEnabled ||
      !data.reminderSettings.browserNotificationsEnabled ||
      document.visibilityState !== 'visible'
    ) {
      return
    }

    const todayKey = getCurrentLocalDayKey()
    const pendingNotifications = upcomingReminders.filter(
      (reminder) => data.reminderState.notifiedDayByReminder[reminder.id] !== todayKey,
    )

    if (!pendingNotifications.length) {
      return
    }

    pendingNotifications.forEach((reminder) => {
      const prefix = reminder.daysUntilDue === 0 ? 'Due today' : `Due in ${reminder.daysUntilDue} day${reminder.daysUntilDue === 1 ? '' : 's'}`
      new Notification(prefix, {
        body: `${reminder.bill.name} • ${formatCurrency(reminder.bill.amountCents)} • ${reminder.dueLabel}`,
        tag: reminder.id,
      })
    })

    setData((current) =>
      pendingNotifications.reduce(
        (nextData, reminder) => markReminderNotified(nextData, reminder.id, todayKey),
        current,
      ),
    )
  }, [
    data.reminderSettings.browserNotificationsEnabled,
    data.reminderSettings.remindersEnabled,
    data.reminderState.notifiedDayByReminder,
    notificationPermission,
    upcomingReminders,
  ])

  function commitData(updater: (current: typeof data) => typeof data, successMessage: string) {
    setData((current) => updater(current))
    setMessage(successMessage)
  }

  function commitReminderPreference(
    updater: (current: typeof data) => typeof data,
    successMessage: string,
  ) {
    commitData((current) => completeReminderSetup(updater(current)), successMessage)
    setShowReminderSettings(false)
  }

  function handleMonthChange(monthKey: MonthKey) {
    startTransition(() => {
      setSelectedMonth(monthKey)
    })

    setExpenseDraft((current) => ({
      ...current,
      date: createMonthDate(monthKey, 1),
    }))
    setIncomeDraft((current) => ({
      ...current,
      date: createMonthDate(monthKey, 1),
    }))
  }

  function handleAddIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amountCents = parseCurrencyInput(incomeDraft.amount)

    if (!amountCents) {
      setMessage('Enter an income amount before saving.')
      return
    }

    commitData(
      (current) =>
        addIncome(current, {
          monthKey: selectedMonth,
          amountCents,
          date: incomeDraft.date,
          note: incomeDraft.note,
        }),
      'Income added. Earned total updated.',
    )

    setIncomeDraft(buildIncomeDraft(selectedMonth))
  }

  function handleSaveIncomeEdit(income: IncomeEntry) {
    const draft = incomeEdits[income.id]
    const amountCents = draft ? parseCurrencyInput(draft.amount) : null

    if (!draft || !amountCents) {
      setMessage('Use a valid amount before updating this income entry.')
      return
    }

    commitData(
      (current) =>
        updateIncome(current, income.id, {
          amountCents,
          date: draft.date,
          note: draft.note,
        }),
      'Income updated.',
    )

    setEditingIncomeId(null)
  }

  function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amountCents = parseCurrencyInput(expenseDraft.amount)

    if (!amountCents) {
      setMessage('Enter an expense amount before saving.')
      return
    }

    commitData(
      (current) =>
        addExpense(current, {
          monthKey: selectedMonth,
          bucketId: expenseDraft.bucketId,
          amountCents,
          date: expenseDraft.date,
          note: expenseDraft.note,
          source: 'manual',
        }),
      'Expense added. Totals updated immediately.',
    )

    setExpenseDraft(buildExpenseDraft(expenseDraft.bucketId, selectedMonth))
  }

  function handleSaveExpenseEdit(expense: Expense) {
    const draft = expenseEdits[expense.id]
    const amountCents = draft ? parseCurrencyInput(draft.amount) : null

    if (!draft || !amountCents) {
      setMessage('Use a valid amount before updating this expense.')
      return
    }

    commitData(
      (current) =>
        updateExpense(current, expense.id, {
          bucketId: draft.bucketId,
          amountCents,
          date: draft.date,
          note: draft.note,
        }),
      'Expense updated.',
    )

    setEditingExpenseId(null)
  }

  function handleAddBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amountCents = parseCurrencyInput(billDraft.amount)

    if (!billDraft.name.trim() || !amountCents) {
      setMessage('Recurring bills need a name and amount.')
      return
    }

    commitData(
      (current) =>
        addRecurringBill(current, {
          name: billDraft.name,
          amountCents,
          bucketId: billDraft.bucketId,
          dueDay: Number(billDraft.dueDay),
        }),
      'Recurring bill added to this month’s required spend.',
    )

    setBillDraft(buildBillDraft(billDraft.bucketId))
  }

  function handleSaveBillEdit(bill: RecurringBill) {
    const draft = billEdits[bill.id]
    const amountCents = draft ? parseCurrencyInput(draft.amount) : null

    if (!draft || !draft.name.trim() || !amountCents) {
      setMessage('Recurring bill updates need a name and amount.')
      return
    }

    commitData(
      (current) =>
        updateRecurringBill(current, bill.id, {
          name: draft.name,
          amountCents,
          bucketId: draft.bucketId,
          dueDay: Number(draft.dueDay),
        }),
      'Recurring bill updated.',
    )

    setEditingBillId(null)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const imported = await readImportedBudgetFile(file)

      startTransition(() => {
        setData(imported)
      })

      setSelectedMonth(getCurrentMonthKey())
      setMessage('Budget imported successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      event.target.value = ''
    }
  }

  function handleExport() {
    const blob = new Blob([buildExportPayload(data)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `budget-export-${selectedMonth}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('Budget export downloaded.')
  }

  function getBucketName(bucketId: string): string {
    return data.buckets.find((bucket) => bucket.id === bucketId)?.name ?? 'Unknown bucket'
  }

  async function handleEnableBrowserNotifications() {
    if (typeof Notification === 'undefined') {
      setMessage('Browser notifications are not supported on this device.')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      commitReminderPreference(
        (current) => updateReminderSettings(current, { browserNotificationsEnabled: true }),
        'Browser notifications enabled while the app is open.',
      )
      return
    }

    commitData(
      (current) => completeReminderSetup(current),
      'Browser notifications were not enabled. In-app reminders still work.',
    )
    setShowReminderSettings(false)
  }

  const allSectionsOpen = sectionKeys.every((key) => openSections[key])

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  function toggleAllSections() {
    setOpenSections(createSectionState(!allSectionsOpen))
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <motion.header
        className="app-header"
        initial="hidden"
        animate="visible"
        variants={enterAnimation}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="app-header__lead">
          <p className="eyebrow">Pocket budget</p>
          <h1>Stay current on what you can actually spend.</h1>
          <p className="header-copy">
            Track live spending, monthly bills, and bucket balances from one phone-friendly view.
          </p>
        </div>

        <div className="header-graphic" aria-hidden="true">
          <motion.div
            className="header-graphic__halo"
            animate={{ scale: [1, 1.06, 1], opacity: [0.68, 0.92, 0.68] }}
            transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <motion.div
            className="header-graphic__ring header-graphic__ring--outer"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          />
          <motion.div
            className="header-graphic__ring header-graphic__ring--inner"
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          />
          <motion.div
            className="header-graphic__core"
            animate={{ y: [0, -8, 0], rotate: [0, 2, 0, -2, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <div className="header-graphic__ledger">
              <span />
              <span />
              <span />
            </div>
            <div className="header-graphic__coin" />
          </motion.div>
          <motion.span
            className="header-graphic__orbit header-graphic__orbit--one"
            animate={{ x: [0, 16, 0], y: [0, -22, 0] }}
            transition={{ duration: 5.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <motion.span
            className="header-graphic__orbit header-graphic__orbit--two"
            animate={{ x: [0, -20, 0], y: [0, 16, 0] }}
            transition={{ duration: 6.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <motion.span
            className="header-graphic__orbit header-graphic__orbit--three"
            animate={{ x: [0, 12, 0], y: [0, 18, 0] }}
            transition={{ duration: 4.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
        </div>

        <div className="header-actions">
          <label className="field field--compact">
            <span>Month</span>
            <input
              aria-label="Budget month"
              type="month"
              value={selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value as MonthKey)}
            />
          </label>
          <div className="theme-switcher" role="group" aria-label="Color theme">
            <button
              className={`theme-switcher__option ${theme === 'light' ? 'theme-switcher__option--active' : ''}`}
              type="button"
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button
              className={`theme-switcher__option ${theme === 'dark' ? 'theme-switcher__option--active' : ''}`}
              type="button"
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
          <button
            className="ghost-button"
            type="button"
            aria-label="Toggle all sections"
            onClick={toggleAllSections}
          >
            {allSectionsOpen ? 'Collapse all sections' : 'Open all sections'}
          </button>
          {!reminderPanelVisible ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowReminderSettings(true)}
            >
              Reminder settings
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={handleExport}>
            Export JSON
          </button>
          <button className="ghost-button" type="button" onClick={() => importInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInputRef}
            hidden
            type="file"
            accept="application/json"
            onChange={handleImport}
          />
          <p className="header-meta">
            {monthOptions.length} tracked month{monthOptions.length === 1 ? '' : 's'}
          </p>
        </div>
      </motion.header>

      {reminderPanelVisible ? (
        <motion.section
          className="reminder-panel"
          initial="hidden"
          animate="visible"
          variants={enterAnimation}
          transition={{ delay: 0.04, duration: 0.42, ease: 'easeOut' }}
        >
        <PanelGraphic kind="reminders" />
        <div className="section-heading reminder-panel__heading">
          <div className="section-heading__copy">
            <p className="eyebrow">Reminders</p>
            <h3>Keep upcoming bills in view.</h3>
            <p className="support-copy">
              These reminders stay local to this device. Browser notifications only fire while the app is open.
            </p>
          </div>
        </div>

        <div className="reminder-controls">
          <label className="field field--compact checkbox-field">
            <span>In-app reminders</span>
            <input
              aria-label="Enable reminders"
              type="checkbox"
              checked={data.reminderSettings.remindersEnabled}
              onChange={(event) =>
                commitReminderPreference(
                  (current) =>
                    updateReminderSettings(current, {
                      remindersEnabled: event.target.checked,
                    }),
                  event.target.checked ? 'In-app reminders enabled.' : 'In-app reminders disabled.',
                )
              }
            />
          </label>
          <label className="field field--compact">
            <span>Remind me</span>
            <select
              aria-label="Reminder timing"
              value={String(data.reminderSettings.remindDaysBefore)}
              onChange={(event) =>
                commitReminderPreference(
                  (current) =>
                    updateReminderSettings(current, {
                      remindDaysBefore: Number(event.target.value) as (typeof reminderDayOptions)[number],
                    }),
                  'Reminder timing updated.',
                )
              }
            >
              {reminderDayOptions.map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? 'On due day' : `${days} day${days === 1 ? '' : 's'} before`}
                </option>
              ))}
            </select>
          </label>

          {typeof Notification === 'undefined' ? (
            <p className="reminder-note">Browser notifications are not supported on this device.</p>
          ) : notificationPermission === 'granted' ? (
            <label className="field field--compact checkbox-field">
              <span>Browser notifications</span>
              <input
                aria-label="Enable browser notifications"
                type="checkbox"
                checked={data.reminderSettings.browserNotificationsEnabled}
                onChange={(event) =>
                  commitReminderPreference(
                    (current) =>
                      updateReminderSettings(current, {
                        browserNotificationsEnabled: event.target.checked,
                      }),
                    event.target.checked
                      ? 'Browser notifications enabled while the app is open.'
                      : 'Browser notifications turned off.',
                  )
                }
              />
            </label>
          ) : (
            <div className="reminder-optin">
              <button className="ghost-button" type="button" onClick={() => void handleEnableBrowserNotifications()}>
                Enable browser notifications
              </button>
              {notificationPermission === 'denied' ? (
                <p className="reminder-note">Notifications are blocked in this browser, so reminders will stay in-app only.</p>
              ) : null}
            </div>
          )}
        </div>

        {data.reminderSettings.remindersEnabled ? (
          <div className="reminder-list">
            {upcomingReminders.length ? (
              upcomingReminders.map((reminder) => (
                <article key={reminder.id} className="reminder-card">
                  <div>
                    <strong>{reminder.bill.name}</strong>
                    <div className="list-row__meta">
                      <span>{reminder.daysUntilDue === 0 ? 'Due today' : `Due in ${reminder.daysUntilDue} day${reminder.daysUntilDue === 1 ? '' : 's'}`}</span>
                      <span>{reminder.dueLabel}</span>
                      <span>{getBucketName(reminder.bill.bucketId)}</span>
                    </div>
                  </div>
                  <div className="reminder-card__actions">
                    <strong>{formatCurrency(reminder.bill.amountCents)}</strong>
                    <button
                      className="ghost-button"
                      type="button"
                      aria-label={`Dismiss ${reminder.bill.name} reminder for today`}
                      onClick={() =>
                        commitData(
                          (current) =>
                            dismissReminderForDay(current, reminder.id, getCurrentLocalDayKey()),
                          'Reminder dismissed for today.',
                        )
                      }
                    >
                      Dismiss for today
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-state">No bills are coming up inside your current reminder window.</p>
            )}
          </div>
        ) : (
          <p className="empty-state">Reminders are off. Turn them on to see upcoming bill alerts.</p>
        )}
        </motion.section>
      ) : null}

      <motion.section
        className="overview-panel"
        initial="hidden"
        animate="visible"
        variants={enterAnimation}
        transition={{ delay: 0.08, duration: 0.45, ease: 'easeOut' }}
      >
        <PanelGraphic kind="overview" />
        <div className="overview-headline">
          <div>
            <p className="eyebrow">{getMonthLabel(selectedMonth)}</p>
            <h2>{formatCurrency(snapshot.availableRemainingCents)}</h2>
            <p className="support-copy">Left in plan after expected income and logged spending.</p>
          </div>

          <label className="field field--compact">
            <span>Expected monthly income</span>
            <input
              aria-label="Expected monthly income"
              inputMode="decimal"
              type="text"
              value={formatCurrencyInput(snapshot.monthPlan.startingAmountCents)}
              onChange={(event) => {
                const amountCents = parseCurrencyInput(event.target.value) ?? 0
                commitData(
                  (current) => setStartingAmount(current, selectedMonth, amountCents),
                  'Expected income updated.',
                )
              }}
            />
          </label>
        </div>

        <div className="metric-grid">
          <OverviewMetric
            label="Expected income"
            value={formatCurrency(snapshot.monthPlan.startingAmountCents)}
          />
          <OverviewMetric
            label="Actual earned"
            value={formatCurrency(snapshot.totalIncomeCents)}
            tone={snapshot.totalIncomeCents > 0 ? 'positive' : 'default'}
          />
          <OverviewMetric label="Spent so far" value={formatCurrency(snapshot.totalSpentCents)} />
          <OverviewMetric label="Required bills" value={formatCurrency(snapshot.requiredSpendCents)} />
          <OverviewMetric
            label="Still unpaid"
            value={formatCurrency(snapshot.outstandingRequiredCents)}
            tone={snapshot.outstandingRequiredCents > 0 ? 'warning' : 'positive'}
          />
        </div>

        <p className="status-line" role="status">
          {message}
        </p>
      </motion.section>

      <main className="section-stack">
        <SectionPanel
          eyebrow="Income"
          title="Track money earned"
          description="Log each paycheck or income source to see the actual total earned this month."
          graphicKind="income"
          isOpen={openSections.income}
          onToggle={() => toggleSection('income')}
        >
          <form className="form-grid" onSubmit={handleAddIncome}>
            <label className="field">
              <span>Amount earned</span>
              <input
                aria-label="Income amount"
                inputMode="decimal"
                type="text"
                placeholder="0.00"
                value={incomeDraft.amount}
                onChange={(event) =>
                  setIncomeDraft((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                aria-label="Income date"
                type="date"
                value={incomeDraft.date}
                onChange={(event) =>
                  setIncomeDraft((current) => ({ ...current, date: event.target.value }))
                }
              />
            </label>
            <label className="field field--wide">
              <span>Source or note</span>
              <input
                aria-label="Income note"
                type="text"
                placeholder="Paycheck, freelance, cash job"
                value={incomeDraft.note}
                onChange={(event) =>
                  setIncomeDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <button className="primary-button" type="submit">
              Add income
            </button>
          </form>

          <div className="list">
            <AnimatePresence initial={false}>
              {snapshot.incomes.map((income) => {
                const isEditing = editingIncomeId === income.id
                const editDraft =
                  incomeEdits[income.id] ?? {
                    amount: formatCurrencyInput(income.amountCents),
                    date: income.date,
                    note: income.note,
                  }

                return (
                  <motion.article
                    key={income.id}
                    className="list-row"
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="list-row__main">
                      <div>
                        <strong>{income.note || 'Income entry'}</strong>
                        <div className="list-row__meta">
                          <span>{income.date}</span>
                          <span>Counts toward actual earned</span>
                        </div>
                      </div>
                      <strong>{formatCurrency(income.amountCents)}</strong>
                    </div>

                    {isEditing ? (
                      <div className="edit-grid">
                        <label className="field">
                          <span>Amount</span>
                          <input
                            aria-label={`Income amount ${income.id}`}
                            inputMode="decimal"
                            type="text"
                            value={editDraft.amount}
                            onChange={(event) =>
                              setIncomeEdits((current) => ({
                                ...current,
                                [income.id]: { ...editDraft, amount: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Date</span>
                          <input
                            aria-label={`Income date ${income.id}`}
                            type="date"
                            value={editDraft.date}
                            onChange={(event) =>
                              setIncomeEdits((current) => ({
                                ...current,
                                [income.id]: { ...editDraft, date: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="field field--wide">
                          <span>Note</span>
                          <input
                            aria-label={`Income note ${income.id}`}
                            type="text"
                            value={editDraft.note}
                            onChange={(event) =>
                              setIncomeEdits((current) => ({
                                ...current,
                                [income.id]: { ...editDraft, note: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <div className="row-actions">
                          <button className="ghost-button" type="button" onClick={() => handleSaveIncomeEdit(income)}>
                            Save
                          </button>
                          <button className="ghost-button" type="button" onClick={() => setEditingIncomeId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="row-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setIncomeEdits((current) => ({
                            ...current,
                            [income.id]: editDraft,
                          }))
                          setEditingIncomeId(income.id)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-button ghost-button--danger"
                        type="button"
                        onClick={() =>
                          commitData(
                            (current) => deleteIncome(current, income.id),
                            'Income removed.',
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
            {!snapshot.incomes.length ? <p className="empty-state">No income logged for this month yet.</p> : null}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Expenses"
          title="Log spending"
          description="Every save updates your month total and bucket balance instantly."
          graphicKind="expenses"
          isOpen={openSections.expenses}
          onToggle={() => toggleSection('expenses')}
        >
          <form className="form-grid" onSubmit={handleAddExpense}>
            <label className="field">
              <span>Bucket</span>
              <select
                aria-label="Expense bucket"
                value={expenseDraft.bucketId}
                onChange={(event) =>
                  setExpenseDraft((current) => ({ ...current, bucketId: event.target.value }))
                }
              >
                {safeBucketOptions.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                aria-label="Expense amount"
                inputMode="decimal"
                type="text"
                placeholder="0.00"
                value={expenseDraft.amount}
                onChange={(event) =>
                  setExpenseDraft((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                aria-label="Expense date"
                type="date"
                value={expenseDraft.date}
                onChange={(event) =>
                  setExpenseDraft((current) => ({ ...current, date: event.target.value }))
                }
              />
            </label>
            <label className="field field--wide">
              <span>Note</span>
              <input
                aria-label="Expense note"
                type="text"
                placeholder="Groceries, coffee, gas"
                value={expenseDraft.note}
                onChange={(event) =>
                  setExpenseDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <button className="primary-button" type="submit">
              Add expense
            </button>
          </form>

          <div className="list">
            <AnimatePresence initial={false}>
              {snapshot.expenses.map((expense) => {
                const isEditing = editingExpenseId === expense.id
                const editDraft =
                  expenseEdits[expense.id] ?? {
                    bucketId: expense.bucketId,
                    amount: formatCurrencyInput(expense.amountCents),
                    date: expense.date,
                    note: expense.note,
                  }

                return (
                  <motion.article
                    key={expense.id}
                    className="list-row"
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="list-row__main">
                      <div className="bucket-pill">
                        <span
                          className="bucket-pill__dot"
                          style={{
                            background: data.buckets.find((bucket) => bucket.id === expense.bucketId)?.color,
                          }}
                        />
                        {getBucketName(expense.bucketId)}
                      </div>
                      <strong>{formatCurrency(expense.amountCents)}</strong>
                    </div>

                    {isEditing ? (
                      <div className="edit-grid">
                        <label className="field">
                          <span>Bucket</span>
                          <select
                            aria-label={`Expense bucket ${expense.id}`}
                            value={editDraft.bucketId}
                            onChange={(event) =>
                              setExpenseEdits((current) => ({
                                ...current,
                                [expense.id]: { ...editDraft, bucketId: event.target.value },
                              }))
                            }
                          >
                            {safeBucketOptions.map((bucket) => (
                              <option key={bucket.id} value={bucket.id}>
                                {bucket.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Amount</span>
                          <input
                            aria-label={`Expense amount ${expense.id}`}
                            inputMode="decimal"
                            type="text"
                            value={editDraft.amount}
                            onChange={(event) =>
                              setExpenseEdits((current) => ({
                                ...current,
                                [expense.id]: { ...editDraft, amount: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Date</span>
                          <input
                            aria-label={`Expense date ${expense.id}`}
                            type="date"
                            value={editDraft.date}
                            onChange={(event) =>
                              setExpenseEdits((current) => ({
                                ...current,
                                [expense.id]: { ...editDraft, date: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="field field--wide">
                          <span>Note</span>
                          <input
                            aria-label={`Expense note ${expense.id}`}
                            type="text"
                            value={editDraft.note}
                            onChange={(event) =>
                              setExpenseEdits((current) => ({
                                ...current,
                                [expense.id]: { ...editDraft, note: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <div className="row-actions">
                          <button className="ghost-button" type="button" onClick={() => handleSaveExpenseEdit(expense)}>
                            Save
                          </button>
                          <button className="ghost-button" type="button" onClick={() => setEditingExpenseId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="list-row__meta">
                        <span>{expense.note || 'No note'}</span>
                        <span>{expense.date}</span>
                      </div>
                    )}

                    <div className="row-actions">
                      {expense.source === 'manual' ? (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setExpenseEdits((current) => ({
                              ...current,
                              [expense.id]: editDraft,
                            }))
                            setEditingExpenseId(expense.id)
                          }}
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="pill-note">Paid from recurring bill</span>
                      )}
                      <button
                        className="ghost-button ghost-button--danger"
                        type="button"
                        onClick={() =>
                          commitData(
                            (current) => deleteExpense(current, expense.id),
                            'Expense removed.',
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
            {!snapshot.expenses.length ? <p className="empty-state">No expenses logged for this month yet.</p> : null}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Recurring bills"
          title="Track required monthly spend"
          description="Mark bills paid to create matching expense entries automatically."
          graphicKind="bills"
          isOpen={openSections.bills}
          onToggle={() => toggleSection('bills')}
        >
          <form className="form-grid" onSubmit={handleAddBill}>
            <label className="field field--wide">
              <span>Bill name</span>
              <input
                aria-label="Bill name"
                type="text"
                placeholder="Rent, internet, phone"
                value={billDraft.name}
                onChange={(event) =>
                  setBillDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                aria-label="Bill amount"
                inputMode="decimal"
                type="text"
                placeholder="0.00"
                value={billDraft.amount}
                onChange={(event) =>
                  setBillDraft((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Due day</span>
              <input
                aria-label="Bill due day"
                inputMode="numeric"
                type="number"
                min="1"
                max="31"
                value={billDraft.dueDay}
                onChange={(event) =>
                  setBillDraft((current) => ({ ...current, dueDay: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Bucket</span>
              <select
                aria-label="Bill bucket"
                value={billDraft.bucketId}
                onChange={(event) =>
                  setBillDraft((current) => ({ ...current, bucketId: event.target.value }))
                }
              >
                {safeBucketOptions.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Add bill
            </button>
          </form>

          <div className="list">
            {snapshot.billSummaries.map(({ bill, state }) => {
              const isEditing = editingBillId === bill.id
              const editDraft =
                billEdits[bill.id] ?? {
                  name: bill.name,
                  amount: formatCurrencyInput(bill.amountCents),
                  bucketId: bill.bucketId,
                  dueDay: String(bill.dueDay),
                }

              return (
                <article key={bill.id} className="list-row">
                  <div className="list-row__main">
                    <div>
                      <strong>{bill.name}</strong>
                      <div className="list-row__meta">
                        <span>{getBucketName(bill.bucketId)}</span>
                        <span>Due day {bill.dueDay}</span>
                      </div>
                    </div>
                    <strong>{formatCurrency(bill.amountCents)}</strong>
                  </div>

                  {isEditing ? (
                    <div className="edit-grid">
                      <label className="field field--wide">
                        <span>Bill name</span>
                        <input
                          aria-label={`Bill name ${bill.id}`}
                          type="text"
                          value={editDraft.name}
                          onChange={(event) =>
                            setBillEdits((current) => ({
                              ...current,
                              [bill.id]: { ...editDraft, name: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Amount</span>
                        <input
                          aria-label={`Bill amount ${bill.id}`}
                          inputMode="decimal"
                          type="text"
                          value={editDraft.amount}
                          onChange={(event) =>
                            setBillEdits((current) => ({
                              ...current,
                              [bill.id]: { ...editDraft, amount: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Due day</span>
                        <input
                          aria-label={`Bill due day ${bill.id}`}
                          inputMode="numeric"
                          type="number"
                          min="1"
                          max="31"
                          value={editDraft.dueDay}
                          onChange={(event) =>
                            setBillEdits((current) => ({
                              ...current,
                              [bill.id]: { ...editDraft, dueDay: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Bucket</span>
                        <select
                          aria-label={`Bill bucket ${bill.id}`}
                          value={editDraft.bucketId}
                          onChange={(event) =>
                            setBillEdits((current) => ({
                              ...current,
                              [bill.id]: { ...editDraft, bucketId: event.target.value },
                            }))
                          }
                        >
                          {safeBucketOptions.map((bucket) => (
                            <option key={bucket.id} value={bucket.id}>
                              {bucket.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="row-actions">
                        <button className="ghost-button" type="button" onClick={() => handleSaveBillEdit(bill)}>
                          Save
                        </button>
                        <button className="ghost-button" type="button" onClick={() => setEditingBillId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="row-actions">
                    <button
                      className={state === 'paid' ? 'ghost-button' : 'primary-button primary-button--small'}
                      type="button"
                      onClick={() =>
                        commitData(
                          (current) => toggleRecurringBillPaid(current, bill.id, selectedMonth),
                          state === 'paid' ? 'Bill marked unpaid.' : 'Bill marked paid and added to expenses.',
                        )
                      }
                    >
                      {state === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setBillEdits((current) => ({
                          ...current,
                          [bill.id]: editDraft,
                        }))
                        setEditingBillId(bill.id)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button ghost-button--danger"
                      type="button"
                      onClick={() =>
                        commitData(
                          (current) => updateRecurringBill(current, bill.id, { active: false }),
                          'Recurring bill archived.',
                        )
                      }
                    >
                      Archive
                    </button>
                  </div>
                </article>
              )
            })}
            {!snapshot.billSummaries.length ? <p className="empty-state">No recurring bills yet.</p> : null}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Buckets"
          title="Budget each category"
          description="Set each bucket for the month, then watch spent and left update automatically."
          graphicKind="buckets"
          isOpen={openSections.buckets}
          onToggle={() => toggleSection('buckets')}
        >
          <form
            className="bucket-create"
            onSubmit={(event) => {
              event.preventDefault()

              if (!bucketDraft.name.trim()) {
                setMessage('Name the bucket before adding it.')
                return
              }

              commitData((current) => addBucket(current, bucketDraft), 'Bucket added.')

              setBucketDraft({
                name: '',
                color: BUCKET_COLORS[(data.buckets.length + 1) % BUCKET_COLORS.length],
              })
            }}
          >
            <label className="field field--wide">
              <span>New bucket</span>
              <input
                aria-label="New bucket name"
                type="text"
                placeholder="Health, travel, gifts"
                value={bucketDraft.name}
                onChange={(event) =>
                  setBucketDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="field field--compact">
              <span>Color</span>
              <select
                aria-label="New bucket color"
                value={bucketDraft.color}
                onChange={(event) =>
                  setBucketDraft((current) => ({ ...current, color: event.target.value }))
                }
              >
                {BUCKET_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Add bucket
            </button>
          </form>

          <div className="bucket-list">
            {snapshot.bucketSummaries.map((summary) => {
              const isOverBudget = summary.remainingCents < 0

              return (
                <article key={summary.bucket.id} className="bucket-row">
                  <div className="bucket-row__identity">
                    <span className="bucket-row__swatch" style={{ background: summary.bucket.color }} />
                    <label className="field field--bare">
                      <span className="sr-only">Bucket name</span>
                      <input
                        aria-label={`${summary.bucket.name} bucket name`}
                        type="text"
                        value={summary.bucket.name}
                        onChange={(event) =>
                          commitData(
                            (current) => updateBucket(current, summary.bucket.id, { name: event.target.value }),
                            'Bucket renamed.',
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="bucket-row__controls">
                    <label className="field field--compact">
                      <span>Budgeted</span>
                      <input
                        aria-label={`${summary.bucket.name} budgeted`}
                        inputMode="decimal"
                        type="text"
                        value={formatCurrencyInput(summary.allocatedCents)}
                        onChange={(event) =>
                          commitData(
                            (current) =>
                              setBucketAllocation(
                                current,
                                selectedMonth,
                                summary.bucket.id,
                                parseCurrencyInput(event.target.value) ?? 0,
                              ),
                            'Bucket allocation updated.',
                          )
                        }
                      />
                    </label>
                    <div className="bucket-balance">
                      <span>Spent</span>
                      <strong>{formatCurrency(summary.spentCents)}</strong>
                    </div>
                    <div className={`bucket-balance ${isOverBudget ? 'bucket-balance--warning' : ''}`}>
                      <span>Left</span>
                      <strong>{formatCurrency(summary.remainingCents)}</strong>
                    </div>
                  </div>

                  <div className="row-actions">
                    {!summary.bucket.archived ? (
                      <button
                        className="ghost-button ghost-button--danger"
                        type="button"
                        onClick={() =>
                          commitData(
                            (current) => archiveBucket(current, summary.bucket.id),
                            'Bucket removed or archived.',
                          )
                        }
                      >
                        {summary.spentCents > 0 ? 'Archive' : 'Delete'}
                      </button>
                    ) : (
                      <span className="pill-note">Archived</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </SectionPanel>
      </main>
    </div>
  )
}

export default App
