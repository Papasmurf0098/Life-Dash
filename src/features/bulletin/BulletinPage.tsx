import { useMemo, useRef, useState } from 'react'
import {
  createBulletinItem,
  isDueToday,
  isOverdue,
  loadBulletinItems,
  parseBulletinItems,
  PRIORITY_META,
  saveBulletinItems,
  sortBulletinItems,
  type BulletinItem,
  type BulletinPriority,
} from './bulletin'

type ViewMode = 'bulletin' | 'schedule' | 'all'

const priorityOptions = Object.entries(PRIORITY_META) as Array<
  [BulletinPriority, (typeof PRIORITY_META)[BulletinPriority]]
>

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatDue(item: BulletinItem): string {
  if (!item.dueDate) return 'Unscheduled'
  const date = new Date(`${item.dueDate}T${item.dueTime || '12:00'}:00`)
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return item.dueTime ? `${label} · ${item.dueTime}` : label
}

export default function BulletinPage() {
  const [items, setItems] = useState<BulletinItem[]>(loadBulletinItems)
  const [view, setView] = useState<ViewMode>('bulletin')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<BulletinPriority>('critical')
  const [editing, setEditing] = useState<BulletinItem | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const commit = (next: BulletinItem[]) => {
    setItems(next)
    saveBulletinItems(next)
  }

  const active = useMemo(
    () => sortBulletinItems(items.filter((item) => item.status === 'active')),
    [items],
  )
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const list = view === 'schedule' ? active.filter((item) => item.dueDate) : view === 'all' ? items : active
    return sortBulletinItems(
      list.filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.notes.toLowerCase().includes(normalizedQuery),
      ),
    )
  }, [active, items, query, view])

  const updateItem = (id: string, patch: Partial<BulletinItem>) => {
    commit(
      items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    )
  }

  return (
    <div className="feature-page bulletin-page">
      <section className="feature-hero feature-hero--magenta">
        <div>
          <h1>Bulletin</h1>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className="metric-strip" aria-label="Bulletin summary">
        <div><span>Active</span><strong>{active.length}</strong></div>
        <div><span>Critical</span><strong>{active.filter((item) => item.priority === 'critical').length}</strong></div>
        <div><span>Due today</span><strong>{active.filter((item) => isDueToday(item)).length}</strong></div>
        <div><span>Overdue</span><strong>{active.filter((item) => isOverdue(item)).length}</strong></div>
      </section>

      <section className="glass-panel capture-panel" id="bulletin-capture">
        <div className="section-title-row">
          <div><h2>Add item</h2></div>
        </div>
        <form
          className="smart-form"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const title = String(data.get('title') ?? '').trim()
            if (!title) return
            commit([
              createBulletinItem({
                title,
                notes: String(data.get('notes') ?? ''),
                priority,
                dueDate: String(data.get('dueDate') ?? ''),
                dueTime: String(data.get('dueTime') ?? ''),
              }),
              ...items,
            ])
            event.currentTarget.reset()
            setPriority('critical')
          }}
        >
          <label className="field field--wide"><span>Title</span><input name="title" required placeholder="Item title" /></label>
          <label className="field field--wide"><span>Notes <em>optional</em></span><textarea name="notes" placeholder="Notes" /></label>
          <fieldset className="chip-field field--wide">
            <legend>Priority</legend>
            <div className="chip-row">
              {priorityOptions.map(([value, meta]) => (
                <button key={value} className={`choice-chip priority-${value} ${priority === value ? 'is-active' : ''}`} type="button" onClick={() => setPriority(value)}>{meta.label}</button>
              ))}
            </div>
          </fieldset>
          <label className="field"><span>Due date <em>optional</em></span><input name="dueDate" type="date" /></label>
          <label className="field"><span>Due time <em>optional</em></span><input name="dueTime" type="time" /></label>
          <button className="primary-action" type="submit">Add item</button>
        </form>
      </section>

      <section className="glass-panel">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Bulletin view">
            {(['bulletin', 'schedule', 'all'] as const).map((mode) => (
              <button key={mode} type="button" className={view === mode ? 'is-active' : ''} onClick={() => setView(mode)}>{mode === 'bulletin' ? 'Priority' : mode[0].toUpperCase() + mode.slice(1)}</button>
            ))}
          </div>
          <label className="search-field"><span className="sr-only">Search bulletin</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items" /></label>
          <div className="toolbar-actions">
            <button className="text-action" type="button" onClick={() => downloadJson('life-dash-bulletin.json', items)}>Export</button>
            <button className="text-action" type="button" onClick={() => importRef.current?.click()}>Import</button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  const parsed = JSON.parse(await file.text()) as unknown
                  commit(parseBulletinItems(parsed))
                } catch {
                  window.alert('That file is not a valid Bulletin export.')
                } finally {
                  event.target.value = ''
                }
              }}
            />
          </div>
        </div>

        <div className="item-list">
          {visible.map((item) => (
            <article key={item.id} className={`priority-card priority-${item.priority} ${item.status === 'completed' ? 'is-complete' : ''}`}>
              <button
                className="completion-toggle"
                type="button"
                aria-label={item.status === 'completed' ? `Restore ${item.title}` : `Complete ${item.title}`}
                onClick={() => updateItem(item.id, { status: item.status === 'completed' ? 'active' : 'completed', completedAt: item.status === 'completed' ? null : new Date().toISOString() })}
              >{item.status === 'completed' ? '✓' : ''}</button>
              <div className="item-copy">
                <div className="item-heading"><span className="priority-label">{PRIORITY_META[item.priority].label}</span><span className={isOverdue(item) ? 'overdue-label' : ''}>{formatDue(item)}</span></div>
                <h3>{item.title}</h3>
                {item.notes ? <p>{item.notes}</p> : null}
              </div>
              <div className="item-actions">
                <button className="icon-action" type="button" onClick={() => setEditing(item)}>Edit</button>
                <button className="icon-action icon-action--danger" type="button" onClick={() => commit(items.filter((entry) => entry.id !== item.id))}>Delete</button>
              </div>
            </article>
          ))}
          {!visible.length ? <div className="empty-state"><strong>No items</strong></div> : null}
        </div>
      </section>

      {editing ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
          <form
            className="modal-card"
            aria-label="Edit Bulletin item"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              updateItem(editing.id, {
                title: String(data.get('title') ?? '').trim(),
                notes: String(data.get('notes') ?? '').trim(),
                priority: String(data.get('priority')) as BulletinPriority,
                dueDate: String(data.get('dueDate') ?? '') || null,
                dueTime: String(data.get('dueTime') ?? '') || null,
              })
              setEditing(null)
            }}
          >
            <div className="section-title-row"><div><h2>Edit item</h2></div><button className="icon-action" type="button" onClick={() => setEditing(null)}>Close</button></div>
            <label className="field"><span>Title</span><input name="title" required defaultValue={editing.title} /></label>
            <label className="field"><span>Notes</span><textarea name="notes" defaultValue={editing.notes} /></label>
            <label className="field"><span>Priority</span><select name="priority" defaultValue={editing.priority}>{priorityOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
            <div className="form-row"><label className="field"><span>Due date</span><input name="dueDate" type="date" defaultValue={editing.dueDate ?? ''} /></label><label className="field"><span>Due time</span><input name="dueTime" type="time" defaultValue={editing.dueTime ?? ''} /></label></div>
            <button className="primary-action" type="submit">Save changes</button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
