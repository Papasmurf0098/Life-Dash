import { useMemo } from 'react'
import { isDueToday, isOverdue, loadBulletinItems, PRIORITY_META, sortBulletinItems } from './features/bulletin/bulletin'
import { deriveMonthSnapshot, formatCurrency, getCurrentMonthKey } from './features/budget/budget'
import { loadBudgetData } from './features/budget/storage'
import { aggregateShifts, getCurrentWeekShifts, loadShiftEntries, projectCurrentMonthEarnings } from './features/tips/tips'
import type { AppRoute } from './App'
import Icon from './shared/Icon'

interface HomePageProps {
  onNavigate: (route: AppRoute) => void
  revision: number
}

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function HomePage({ onNavigate, revision }: HomePageProps) {
  const snapshot = useMemo(() => {
    void revision
    const bulletin = sortBulletinItems(loadBulletinItems().filter((item) => item.status === 'active'))
    const shifts = loadShiftEntries()
    const budget = deriveMonthSnapshot(loadBudgetData(), getCurrentMonthKey())
    return {
      bulletin,
      week: aggregateShifts(getCurrentWeekShifts(shifts)),
      monthProjection: projectCurrentMonthEarnings(shifts),
      budget,
    }
  }, [revision])

  const topPriority = snapshot.bulletin[0]
  const dueCount = snapshot.bulletin.filter((item) => isDueToday(item) || isOverdue(item)).length

  return (
    <div className="feature-page home-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="kicker">Today</p>
          <h1>Overview</h1>
          <div className="hero-actions"><button className="primary-action" type="button" onClick={() => onNavigate('bulletin')}>Add item</button><button className="secondary-action" type="button" onClick={() => onNavigate('tips')}>Log shift</button></div>
        </div>
        <div className="constellation" aria-hidden="true"><span className="constellation__core" /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="home-grid">
        <button className="home-card home-card--priority" type="button" onClick={() => onNavigate('bulletin')}>
          <div className="home-card__heading"><span className="card-icon"><Icon name="bulletin" /></span><div><p className="kicker">Priority</p><h2>{topPriority?.title ?? 'No active items'}</h2></div></div>
          {topPriority ? <>{topPriority.notes ? <p>{topPriority.notes}</p> : null}<div className="card-footer"><span className={`priority-label priority-${topPriority.priority}`}>{PRIORITY_META[topPriority.priority].label}</span><span>{dueCount ? `${dueCount} due or overdue` : 'Current'}</span></div></> : null}
        </button>

        <button className="home-card home-card--earnings" type="button" onClick={() => onNavigate('tips')}>
          <div className="home-card__heading"><span className="card-icon"><Icon name="shifts" /></span><div><p className="kicker">Projected earnings</p><h2>{dollars.format(snapshot.week.projectedEarnings)}</h2></div></div>
          <p>Friday–Thursday · {snapshot.week.shifts} shifts · {snapshot.week.hours.toFixed(1)} hours</p>
          <div className="mini-ledger"><span>Net tips <b>{dollars.format(snapshot.week.netTips)}</b></span><span>$12 base <b>{dollars.format(snapshot.week.basePay)}</b></span><span>Tip-out <b>−{dollars.format(snapshot.week.tipOut)}</b></span></div>
          <div className="card-footer"><span>{dollars.format(snapshot.week.avgHourly)}/hr projected</span><span>Pre-tax estimate</span></div>
        </button>

        <button className="home-card home-card--budget" type="button" onClick={() => onNavigate('budget')}>
          <div className="home-card__heading"><span className="card-icon"><Icon name="wallet" /></span><div><p className="kicker">Take-home pay</p><h2>{formatCurrency(snapshot.budget.totalIncomeCents)}</h2></div></div>
          <div className="mini-ledger"><span>Plan <b>{formatCurrency(snapshot.budget.monthPlan.startingAmountCents)}</b></span><span>Spent <b>{formatCurrency(snapshot.budget.totalSpentCents)}</b></span><span>Unpaid bills <b>{formatCurrency(snapshot.budget.outstandingRequiredCents)}</b></span></div>
          <div className="card-footer"><span>{formatCurrency(snapshot.budget.availableRemainingCents)} left in plan</span><span>Recorded income only</span></div>
        </button>

        <article className="home-card home-card--forecast">
          <div className="home-card__heading"><span className="card-icon"><Icon name="trend" /></span><div><p className="kicker">Month projection</p><h2>{dollars.format(snapshot.monthProjection)}</h2></div></div>
          <div className="forecast-scale"><span style={{ width: `${Math.min(100, snapshot.monthProjection ? (snapshot.week.projectedEarnings / snapshot.monthProjection) * 100 : 0)}%` }} /></div>
          <div className="card-footer"><span>Projected pace</span><span>Pre-tax</span></div>
        </article>
      </section>

      <section className="glass-panel utility-panel quick-launch">
        <div><h2>Quick actions</h2></div>
        <div className="quick-launch__actions"><button type="button" onClick={() => onNavigate('bulletin')}><Icon name="plus" size={17} />Add item</button><button type="button" onClick={() => onNavigate('tips')}><Icon name="shifts" size={17} />Log shift</button><button type="button" onClick={() => onNavigate('budget')}><Icon name="wallet" size={17} />Add take-home pay</button></div>
      </section>
    </div>
  )
}
