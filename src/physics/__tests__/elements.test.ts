import { describe, it, expect } from 'vitest'
import { ELEMENTS, elementByZ, MAX_Z } from '../elements'

describe('elements', () => {
  it('has Z=1..118 in order with unique symbols and names', () => {
    expect(MAX_Z).toBe(118)
    expect(ELEMENTS.length).toBe(MAX_Z)
    expect(new Set(ELEMENTS.map((e) => e.name)).size).toBe(MAX_Z)
    ELEMENTS.forEach((e, i) => expect(e.Z).toBe(i + 1))
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(MAX_Z)
  })
  it('spot checks', () => {
    expect(elementByZ(26)).toMatchObject({ symbol: 'Fe', name: 'Iron', group: 8, period: 4, block: 'd' })
    expect(elementByZ(10)).toMatchObject({ symbol: 'Ne', group: 18, period: 2, block: 'p' })
    expect(elementByZ(2)).toMatchObject({ symbol: 'He', group: 18, period: 1, block: 's' })
    expect(elementByZ(119)).toBeUndefined()
    expect(elementByZ(64)).toMatchObject({ symbol: 'Gd', name: 'Gadolinium', period: 6, block: 'f' })
    expect(elementByZ(92)).toMatchObject({ symbol: 'U', name: 'Uranium', period: 7, block: 'f' })
    expect(elementByZ(82)).toMatchObject({ symbol: 'Pb', group: 14, period: 6, block: 'p' })
    expect(elementByZ(118)).toMatchObject({ symbol: 'Og', group: 18, period: 7, block: 'p' })
    expect(ELEMENTS.filter((e) => e.block === 'f').length).toBe(30)
    expect(ELEMENTS.filter((e) => e.block === 'd').length).toBe(38) // 10 + 10 + 9 + 9 (La, Ac tagged f)
    for (const e of ELEMENTS) expect(e.cpk).toMatch(/^#[0-9a-f]{6}$/i)
    for (const e of ELEMENTS) expect(e.group >= 1 && e.group <= 18 && e.period >= 1 && e.period <= 7).toBe(true)
  })
})
