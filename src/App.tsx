import { useEffect, useRef, useState } from 'react'
import HomePage from './HomePage'
import BulletinPage from './features/bulletin/BulletinPage'
import BudgetPage from './features/budget/App'
import TipTrackerPage from './features/tips/TipTrackerPage'
import { LIFE_DASH_DATA_EVENT } from './shared/events'
import { downloadLifeDashBackup, restoreLifeDashBackup } from './shared/backup'

export type AppRoute = 'home' | 'bulletin' | 'tips' | 'budget'

const ROUTES: Array<{ id: AppRoute; label: string; shortLabel: string; glyph: string }> = [
  { id: 'home', label: 'Overview', shortLabel: 'Home', glyph: '⌂' },
  { id: 'bulletin', label: 'Bulletin', shortLabel: 'Bulletin', glyph: '✦' },
  { id: 'tips', label: 'Shift Tracker', shortLabel: 'Shifts', glyph: '↗' },
  { id: 'budget', label: 'Take-home Budget', shortLabel: 'Budget', glyph: '$' },
]

function getInitialRoute(): AppRoute {
  const hash = window.location.hash.replace('#/', '')
  return ROUTES.some((route) => route.id === hash) ? (hash as AppRoute) : 'home'
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(getInitialRoute)
  const [revision, setRevision] = useState(0)
  const [backupOpen, setBackupOpen] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const navigate = (next: AppRoute) => {
    setRoute(next)
    window.location.hash = `/${next}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    const onHashChange = () => setRoute(getInitialRoute())
    const onDataChange = () => setRevision((value) => value + 1)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener(LIFE_DASH_DATA_EVENT, onDataChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener(LIFE_DASH_DATA_EVENT, onDataChange)
    }
  }, [])

  return (
    <div className="life-shell">
      <aside className="life-sidebar">
        <button className="life-brand" type="button" onClick={() => navigate('home')} aria-label="Life Dash home">
          <span className="life-brand__mark">L</span>
          <span><strong>Life Dash</strong><small>Personal command center</small></span>
        </button>
        <nav className="primary-nav" aria-label="Life Dash sections">
          {ROUTES.map((item) => (
            <button key={item.id} type="button" className={route === item.id ? 'is-active' : ''} onClick={() => navigate(item.id)}>
              <span className="nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p><span className="privacy-dot" />Stored privately on this device</p>
          <button type="button" onClick={() => setBackupOpen(true)}>Backup & restore</button>
        </div>
      </aside>

      <div className="life-main">
        <header className="life-topbar">
          <div><span className="topbar-status" />Local-first</div>
          <p>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <button type="button" onClick={() => setBackupOpen(true)}>Backup</button>
        </header>
        <main id="main-content" key={route}>
          {route === 'home' ? <HomePage onNavigate={navigate} revision={revision} /> : null}
          {route === 'bulletin' ? <BulletinPage /> : null}
          {route === 'tips' ? <TipTrackerPage /> : null}
          {route === 'budget' ? <div className="budget-host"><BudgetPage /></div> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Life Dash sections">
        {ROUTES.map((item) => (
          <button key={item.id} type="button" className={route === item.id ? 'is-active' : ''} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.glyph}</span><small>{item.shortLabel}</small></button>
        ))}
      </nav>

      {backupOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setBackupOpen(false)}>
          <section className="modal-card backup-card" role="dialog" aria-modal="true" aria-labelledby="backup-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-title-row"><div><p className="kicker">Data safety</p><h2 id="backup-title">One backup for your whole dashboard</h2></div><button className="icon-action" type="button" onClick={() => setBackupOpen(false)}>Close</button></div>
            <p>Download Bulletin, Shift Tracker, and Budget together. Restoring replaces the current data in all three modules after the file is validated.</p>
            <div className="backup-actions">
              <button className="primary-action" type="button" onClick={downloadLifeDashBackup}>Download full backup</button>
              <button className="secondary-action" type="button" onClick={() => importRef.current?.click()}>Restore from backup</button>
              <input ref={importRef} hidden type="file" accept="application/json" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  restoreLifeDashBackup(JSON.parse(await file.text()) as unknown)
                  setRestoreMessage('Backup restored. Reloading Life Dash…')
                  window.setTimeout(() => window.location.reload(), 700)
                } catch (error) {
                  setRestoreMessage(error instanceof Error ? error.message : 'The backup could not be restored.')
                } finally {
                  event.target.value = ''
                }
              }} />
            </div>
            <p className="status-message" role="status">{restoreMessage || 'Your data remains local unless you download and move the backup file yourself.'}</p>
          </section>
        </div>
      ) : null}
    </div>
  )
}
