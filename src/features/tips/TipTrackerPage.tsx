import { useMemo, useRef, useState } from 'react'
import {
  aggregateShifts,
  FOOD_TIP_OUT_RATE,
  getCurrentWeekShifts,
  getRecentWeeklyEarnings,
  HOURLY_WAGE,
  LIQUOR_TIP_OUT_RATE,
  loadShiftEntries,
  normalizeShift,
  parseShiftEntries,
  projectCurrentMonthEarnings,
  saveShiftEntries,
  TIP_TAGS,
  type ShiftEntry,
  type ShiftTotals,
  type WeeklyEarningsPoint,
} from './tips'
import Icon from '../../shared/Icon'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function downloadJson(entries: ShiftEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'life-dash-shifts.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function todayKey(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function groupBySection(entries: ShiftEntry[]) {
  const groups = new Map<string, ShiftEntry[]>()
  entries.forEach((entry) => groups.set(entry.section, [...(groups.get(entry.section) ?? []), entry]))
  return Array.from(groups, ([section, shifts]) => ({ section, ...aggregateShifts(shifts) }))
    .toSorted((left, right) => right.avgHourly - left.avgHourly)
}

function EarningsVisuals({ totals, trend }: { totals: ShiftTotals; trend: WeeklyEarningsPoint[] }) {
  const compositionTotal = Math.max(0, totals.basePay) + Math.max(0, totals.netTips)
  const baseWidth = compositionTotal ? (Math.max(0, totals.basePay) / compositionTotal) * 100 : 0
  const tipsWidth = compositionTotal ? (Math.max(0, totals.netTips) / compositionTotal) * 100 : 0
  const width = 640
  const height = 190
  const padX = 22
  const padY = 24
  const chartWidth = width - padX * 2
  const chartHeight = height - padY * 2
  const maximum = Math.max(...trend.map((point) => point.projectedEarnings), 1)
  const points = trend.map((point, index) => ({
    ...point,
    x: padX + (trend.length === 1 ? chartWidth / 2 : (index / (trend.length - 1)) * chartWidth),
    y: padY + chartHeight - (point.projectedEarnings / maximum) * chartHeight,
  }))
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x ?? padX} ${height - padY} L ${points[0].x} ${height - padY} Z`
    : ''
  const activePoints = trend.filter((point) => point.shifts)
  const bestWeek = activePoints.toSorted((left, right) => right.projectedEarnings - left.projectedEarnings)[0]
  const currentWeek = trend.at(-1)

  return (
    <section className="earnings-visuals" aria-label="Projected earnings visuals">
      <article className="visual-panel composition-card">
        <div className="visual-heading">
          <span className="visual-icon"><Icon name="wallet" size={18} /></span>
          <div><p className="kicker">Earnings anatomy</p><h2>{currency.format(totals.projectedEarnings)}</h2></div>
        </div>
        <p className="visual-support">Projected earnings in the current view, after estimated tip-out and before taxes or paycheck deductions.</p>
        <div className="composition-track" role="img" aria-label={`${currency.format(totals.basePay)} base pay and ${currency.format(totals.netTips)} net tips`}>
          <span className="composition-track__base" style={{ width: `${baseWidth}%` }} />
          <span className="composition-track__tips" style={{ width: `${tipsWidth}%` }} />
        </div>
        <div className="composition-legend">
          <span><i className="legend-dot legend-dot--base" />Base pay <strong>{currency.format(totals.basePay)}</strong></span>
          <span><i className="legend-dot legend-dot--tips" />Net tips <strong>{currency.format(totals.netTips)}</strong></span>
        </div>
        <div className="tipout-breakdown">
          <span><Icon name="plate" size={16} />Food tip-out <strong>−{currency.format(totals.foodTipOut)}</strong></span>
          <span><Icon name="cocktail" size={16} />Liquor tip-out <strong>−{currency.format(totals.liquorTipOut)}</strong></span>
        </div>
      </article>

      <article className="visual-panel trend-card">
        <div className="visual-heading">
          <span className="visual-icon"><Icon name="trend" size={18} /></span>
          <div><p className="kicker">Eight-week signal</p><h2>{currentWeek ? currency.format(currentWeek.projectedEarnings) : '$0.00'}</h2></div>
        </div>
        <div className="trend-chart">
          <svg role="img" aria-label="Projected earnings by Friday-through-Thursday week" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--module-accent)" stopOpacity=".52" />
                <stop offset="100%" stopColor="var(--module-secondary)" stopOpacity=".02" />
              </linearGradient>
              <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--module-secondary)" />
                <stop offset="55%" stopColor="var(--module-accent)" />
                <stop offset="100%" stopColor="var(--life-magenta)" />
              </linearGradient>
            </defs>
            <path className="trend-gridline" d={`M ${padX} ${padY} H ${width - padX} M ${padX} ${padY + chartHeight / 2} H ${width - padX} M ${padX} ${height - padY} H ${width - padX}`} />
            {areaPath ? <path className="trend-area" d={areaPath} /> : null}
            {linePath ? <path className="trend-line" d={linePath} /> : null}
            {points.map((point) => <circle key={point.weekStart} className={point.shifts ? 'trend-point is-active' : 'trend-point'} cx={point.x} cy={point.y} r={point.shifts ? 5 : 3}><title>{point.label}: {currency.format(point.projectedEarnings)} across {point.shifts} shifts</title></circle>)}
          </svg>
          <div className="trend-axis"><span>{trend[0]?.label ?? ''}</span><span>{trend.at(-1)?.label ?? ''}</span></div>
        </div>
        <div className="trend-footer"><span>Best week <strong>{bestWeek ? currency.format(bestWeek.projectedEarnings) : 'No shifts yet'}</strong></span><span>Current tip-out <strong>−{currency.format(currentWeek?.tipOut ?? 0)}</strong></span></div>
      </article>
    </section>
  )
}

interface Draft {
  date: string
  section: string
  hours: string
  tips: string
  foodSales: string
  liquorSales: string
  notes: string
  tags: string[]
}

const emptyDraft = (): Draft => ({
  date: todayKey(),
  section: '',
  hours: '',
  tips: '',
  foodSales: '',
  liquorSales: '',
  notes: '',
  tags: [],
})

export default function TipTrackerPage() {
  const [entries, setEntries] = useState<ShiftEntry[]>(loadShiftEntries)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState('')
  const [weekOnly, setWeekOnly] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const commit = (next: ShiftEntry[]) => {
    const sorted = next.toSorted((left, right) => left.date.localeCompare(right.date))
    setEntries(sorted)
    saveShiftEntries(sorted)
  }

  const visibleEntries = useMemo(() => {
    const dateFiltered = weekOnly ? getCurrentWeekShifts(entries) : entries
    return dateFiltered.filter((entry) => !sectionFilter || entry.section === sectionFilter)
  }, [entries, sectionFilter, weekOnly])
  const totals = useMemo(() => aggregateShifts(visibleEntries), [visibleEntries])
  const weekTotals = useMemo(() => aggregateShifts(getCurrentWeekShifts(entries)), [entries])
  const weeklyTrend = useMemo(() => getRecentWeeklyEarnings(entries), [entries])
  const sectionStats = useMemo(() => groupBySection(visibleEntries), [visibleEntries])
  const maxSectionHourly = Math.max(...sectionStats.map((section) => section.avgHourly), 1)
  const sections = [...new Set(entries.map((entry) => entry.section))].toSorted()

  const draftHours = Number(draft.hours || 0)
  const draftTips = Number(draft.tips || 0)
  const draftFoodSales = Number(draft.foodSales || 0)
  const draftLiquorSales = Number(draft.liquorSales || 0)
  const draftBasePay = draftHours * HOURLY_WAGE
  const draftFoodTipOut = draftFoodSales * FOOD_TIP_OUT_RATE
  const draftLiquorTipOut = draftLiquorSales * LIQUOR_TIP_OUT_RATE
  const draftProjected = draftTips + draftBasePay - draftFoodTipOut - draftLiquorTipOut

  const resetDraft = () => {
    setDraft(emptyDraft())
    setEditingId(null)
  }

  return (
    <div className="feature-page tips-page">
      <section className="feature-hero feature-hero--cyan">
        <div>
          <p className="kicker">Shift intelligence</p>
          <h1>Know what the room is really worth.</h1>
          <p>Track service patterns and estimate gross shift earnings before taxes, paycheck deductions, and other costs.</p>
        </div>
        <div className="earnings-signal" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </section>

      <aside className="truth-banner">
        <strong>Projection, not take-home pay.</strong>
        <span>Tip Tracker never adds money to Budget. Only take-home pay you deliberately record in Budget counts as income.</span>
      </aside>

      <section className="metric-strip metric-strip--five" aria-label="Current shift totals">
        <div><span>Projected earnings</span><strong>{currency.format(totals.projectedEarnings)}</strong></div>
        <div><span>Tips before tip-out</span><strong>{currency.format(totals.tips)}</strong></div>
        <div><span>Total tip-out</span><strong>−{currency.format(totals.tipOut)}</strong></div>
        <div><span>Base pay · $12/hr</span><strong>{currency.format(totals.basePay)}</strong></div>
        <div><span>Projected / hour</span><strong>{currency.format(totals.avgHourly)}</strong></div>
      </section>

      <EarningsVisuals totals={totals} trend={weeklyTrend} />

      <section className="glass-panel">
        <div className="section-title-row">
          <div><p className="kicker">{editingId ? 'Edit shift' : 'Log shift'}</p><h2>{editingId ? 'Correct the record' : 'Capture the whole service picture'}</h2></div>
          {editingId ? <button className="text-action" type="button" onClick={resetDraft}>Cancel edit</button> : null}
        </div>

        <form
          className="smart-form shift-form"
          onSubmit={(event) => {
            event.preventDefault()
            const shift = normalizeShift({
              id: editingId ?? undefined,
              date: draft.date,
              section: draft.section,
              hours: draft.hours,
              tips: draft.tips,
              foodSales: draft.foodSales,
              liquorSales: draft.liquorSales,
              notes: draft.notes,
              tags: draft.tags,
            })
            if (!shift) return
            commit(editingId ? entries.map((entry) => entry.id === editingId ? shift : entry) : [...entries, shift])
            resetDraft()
          }}
        >
          <label className="field"><span>Date</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label className="field"><span>Section</span><input required value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} placeholder="Patio, 20s, bar" /></label>
          <label className="field"><span>Hours worked</span><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} placeholder="6.5" /></label>
          <label className="field"><span>Tips before tip-out</span><input required inputMode="decimal" type="number" min="0" step="0.01" value={draft.tips} onChange={(event) => setDraft({ ...draft, tips: event.target.value })} placeholder="225.00" /></label>
          <label className="field"><span className="field-label--icon"><Icon name="plate" size={15} />Total food sales <em>optional · 2%</em></span><input inputMode="decimal" type="number" min="0" step="0.01" value={draft.foodSales} onChange={(event) => setDraft({ ...draft, foodSales: event.target.value })} placeholder="1000.00" /></label>
          <label className="field"><span className="field-label--icon"><Icon name="cocktail" size={15} />Total liquor sales <em>optional · 8%</em></span><input inputMode="decimal" type="number" min="0" step="0.01" value={draft.liquorSales} onChange={(event) => setDraft({ ...draft, liquorSales: event.target.value })} placeholder="250.00" /></label>
          <label className="field field--wide"><span>Notes <em>optional</em></span><input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Event, weather, staffing, table mix" /></label>
          <fieldset className="chip-field field--wide">
            <legend>Shift signals</legend>
            <div className="chip-row">
              {TIP_TAGS.map((tag) => (
                <button key={tag} className={`choice-chip ${draft.tags.includes(tag) ? 'is-active' : ''}`} type="button" onClick={() => setDraft({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((value) => value !== tag) : [...draft.tags, tag] })}>{tag}</button>
              ))}
            </div>
          </fieldset>

          <div className="projection-preview field--wide">
            <div><span>Base pay</span><strong>{currency.format(draftBasePay)}</strong><small>{draftHours || 0} hr × $12</small></div>
            <div><span>Food tip-out</span><strong>−{currency.format(draftFoodTipOut)}</strong><small>2% of food sales</small></div>
            <div><span>Liquor tip-out</span><strong>−{currency.format(draftLiquorTipOut)}</strong><small>8% of liquor sales</small></div>
            <div className="projection-preview__total"><span>Projected shift earnings</span><strong>{currency.format(Number.isFinite(draftProjected) ? draftProjected : 0)}</strong><small>Pre-tax estimate</small></div>
          </div>
          <button className="primary-action" type="submit">{editingId ? 'Update shift' : 'Save shift'}</button>
        </form>
      </section>

      <section className="insight-grid">
        <article className="glass-panel insight-card">
          <p className="kicker">Friday–Thursday</p><h2>{currency.format(weekTotals.projectedEarnings)}</h2>
          <p>Projected across {weekTotals.shifts} shift{weekTotals.shifts === 1 ? '' : 's'} · {weekTotals.hours.toFixed(1)} hours.</p>
          <div className="detail-pairs"><span>Net tips <b>{currency.format(weekTotals.netTips)}</b></span><span>Base pay <b>{currency.format(weekTotals.basePay)}</b></span></div>
        </article>
        <article className="glass-panel insight-card insight-card--violet">
          <p className="kicker">Month pace</p><h2>{currency.format(projectCurrentMonthEarnings(entries))}</h2>
          <p>Projected month-end gross earnings based on recorded pace so far.</p>
          <small>This is directional—not a paycheck or tax estimate.</small>
        </article>
      </section>

      <section className="glass-panel">
        <div className="section-title-row">
          <div><p className="kicker">Pattern read</p><h2>Where your time performs</h2></div>
          <div className="toolbar-actions">
            <button className={`text-action ${weekOnly ? 'is-active' : ''}`} type="button" onClick={() => setWeekOnly(!weekOnly)}>This week</button>
            <select aria-label="Filter section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}><option value="">All sections</option>{sections.map((section) => <option key={section}>{section}</option>)}</select>
          </div>
        </div>
        <div className="performance-list">
          {sectionStats.map((section, index) => (
            <article key={section.section} className="performance-row">
              <div><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><strong>{section.section}</strong><small>{section.shifts} shifts · {section.hours.toFixed(1)} hr</small></div>
              <div className="performance-bar"><span style={{ width: `${Math.max(4, (section.avgHourly / maxSectionHourly) * 100)}%` }} /></div>
              <strong>{currency.format(section.avgHourly)}/hr</strong>
            </article>
          ))}
          {!sectionStats.length ? <div className="empty-state"><strong>No signal yet.</strong><span>Log shifts to compare sections.</span></div> : null}
        </div>
      </section>

      <section className="glass-panel">
        <div className="section-title-row">
          <div><p className="kicker">History</p><h2>Shift ledger</h2></div>
          <div className="toolbar-actions">
            <button className="text-action" type="button" onClick={() => downloadJson(entries)}>Export</button>
            <button className="text-action" type="button" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} hidden type="file" accept="application/json" onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try { commit(parseShiftEntries(JSON.parse(await file.text()))) }
              catch { window.alert('That file is not a valid Tip Tracker export.') }
              finally { event.target.value = '' }
            }} />
          </div>
        </div>
        <div className="shift-ledger">
          {visibleEntries.toReversed().map((entry) => (
            <article key={entry.id} className="shift-row">
              <div className="shift-row__date"><strong>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span>{entry.section}</span></div>
              <div><span>Tips</span><strong>{currency.format(entry.tips)}</strong></div>
              <div><span>Tip-out</span><strong>−{currency.format(entry.tipOut)}</strong><small>{entry.foodSales !== null ? `Food ${currency.format(entry.foodSales)}` : ''}{entry.foodSales !== null && entry.liquorSales !== null ? ' · ' : ''}{entry.liquorSales !== null ? `Liquor ${currency.format(entry.liquorSales)}` : ''}</small></div>
              <div><span>$12 base</span><strong>{currency.format(entry.basePay)}</strong><small>{entry.hours.toFixed(2)} hr</small></div>
              <div className="shift-row__projected"><span>Projected</span><strong>{currency.format(entry.projectedEarnings)}</strong><small>{currency.format(entry.hourly)}/hr · pre-tax</small></div>
              <div className="item-actions"><button className="icon-action" type="button" onClick={() => { setEditingId(entry.id); setDraft({ date: entry.date, section: entry.section, hours: String(entry.hours), tips: String(entry.tips), foodSales: entry.foodSales === null ? '' : String(entry.foodSales), liquorSales: entry.liquorSales === null ? '' : String(entry.liquorSales), notes: entry.notes, tags: entry.tags }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button><button className="icon-action icon-action--danger" type="button" onClick={() => commit(entries.filter((shift) => shift.id !== entry.id))}>Delete</button></div>
            </article>
          ))}
          {!visibleEntries.length ? <div className="empty-state"><strong>No shifts in this view.</strong><span>Log a shift or clear the filters.</span></div> : null}
        </div>
      </section>
    </div>
  )
}
