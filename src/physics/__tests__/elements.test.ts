import { describe, it, expect } from 'vitest'
import { ELEMENTS, elementByZ, MAX_Z } from '../elements'

describe('elements', () => {
  it('has Z=1..36 in order with unique symbols', () => {
    expect(ELEMENTS.length).toBe(MAX_Z)
    ELEMENTS.forEach((e, i) => expect(e.Z).toBe(i + 1))
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(MAX_Z)
  })
  it('spot checks', () => {
    expect(elementByZ(26)).toMatchObject({ symbol: 'Fe', name: 'Iron', group: 8, period: 4, block: 'd' })
    expect(elementByZ(10)).toMatchObject({ symbol: 'Ne', group: 18, period: 2, block: 'p' })
    expect(elementByZ(2)).toMatchObject({ symbol: 'He', group: 18, period: 1, block: 's' })
    expect(elementByZ(37)).toBeUndefined()
    for (const e of ELEMENTS) expect(e.cpk).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
