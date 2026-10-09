import { describe, it, expect } from 'vitest'
import { Store, DEFAULT_STATE } from '../state'

describe('Store', () => {
  it('emits only the keys that changed', () => {
    const store = new Store()
    const seen: string[][] = []
    store.subscribe((_s, changed) => seen.push([...changed]))
    store.set({ Z: 26, mode: DEFAULT_STATE.mode })
    expect(seen).toEqual([['Z']])
    expect(store.state.Z).toBe(26)
  })
  it('does not emit when nothing changed', () => {
    const store = new Store()
    let calls = 0
    store.subscribe(() => calls++)
    store.set({ n: DEFAULT_STATE.n })
    expect(calls).toBe(0)
  })
  it('compares arrays by value', () => {
    const store = new Store()
    let calls = 0
    store.subscribe(() => calls++)
    store.set({ hiddenSubshells: [] })
    expect(calls).toBe(0)
    store.set({ hiddenSubshells: ['1s'] })
    expect(calls).toBe(1)
  })
  it('unsubscribe stops notifications', () => {
    const store = new Store()
    let calls = 0
    const off = store.subscribe(() => calls++)
    off()
    store.set({ Z: 2 })
    expect(calls).toBe(0)
  })
})
