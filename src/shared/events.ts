export const LIFE_DASH_DATA_EVENT = 'life-dash:data-changed'

export type LifeDashModule = 'bulletin' | 'tips' | 'budget'

export function announceDataChange(module: LifeDashModule): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LIFE_DASH_DATA_EVENT, { detail: { module } }))
}
