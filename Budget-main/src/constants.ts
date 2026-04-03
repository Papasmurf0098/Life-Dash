import type { Bucket } from './types'

export const DATA_VERSION = 2
export const STORAGE_KEY = 'budget-app-data-v2'

export const STARTER_BUCKETS: Bucket[] = [
  { id: 'housing', name: 'Housing', color: '#3559e6', archived: false },
  { id: 'food', name: 'Food', color: '#ff7a59', archived: false },
  { id: 'transport', name: 'Transport', color: '#0f766e', archived: false },
  { id: 'utilities', name: 'Utilities', color: '#7c3aed', archived: false },
  { id: 'shopping', name: 'Shopping', color: '#d946ef', archived: false },
  { id: 'life', name: 'Life', color: '#f59e0b', archived: false },
]

export const BUCKET_COLORS = [
  '#3559e6',
  '#ff7a59',
  '#0f766e',
  '#7c3aed',
  '#d946ef',
  '#f59e0b',
  '#0f9db6',
  '#d14343',
]
