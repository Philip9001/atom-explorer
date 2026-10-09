import { describe, it, expect } from 'vitest'
import { singleFlight } from '../singleFlight'

describe('singleFlight', () => {
  it('returns the in-flight promise to concurrent callers and runs again after it settles', async () => {
    let runs = 0
    let release!: () => void
    const fn = singleFlight(() => { runs++; return new Promise<number>((r) => { release = () => r(runs) }) })
    const a = fn(), b = fn()
    expect(runs).toBe(1)
    release()
    expect(await a).toBe(1)
    expect(await b).toBe(1)
    const c = fn()
    expect(runs).toBe(2)
    release()
    await c
  })
})
