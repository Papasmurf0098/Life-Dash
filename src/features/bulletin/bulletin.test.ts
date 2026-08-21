import { describe, expect, it } from 'vitest'
import { normalizeBulletinItem, parseBulletinItems, sortBulletinItems } from './bulletin'

describe('Bulletin data migration', () => {
  it('normalizes legacy items while preserving their identity', () => {
    expect(
      normalizeBulletinItem({
        id: 'thought-1',
        title: '  Call the vet  ',
        priority: 'critical',
        status: 'active',
        dueDate: '2026-08-21',
      }),
    ).toMatchObject({
      id: 'thought-1',
      title: 'Call the vet',
      notes: '',
      priority: 'critical',
      status: 'active',
      dueDate: '2026-08-21',
    })
  })

  it('ranks active critical thoughts above lower-priority items', () => {
    const items = parseBulletinItems([
      { id: 'normal', title: 'Normal', priority: 'normal', status: 'active' },
      { id: 'critical', title: 'Critical', priority: 'critical', status: 'active' },
    ])

    expect(sortBulletinItems(items).map((item) => item.id)).toEqual(['critical', 'normal'])
  })
})
