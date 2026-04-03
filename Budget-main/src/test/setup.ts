import '@testing-library/jest-dom/vitest'

class IntersectionObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return []
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
})

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
})

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: () => 'blob:mock',
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: () => undefined,
})
