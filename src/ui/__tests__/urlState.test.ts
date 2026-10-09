import { describe, it, expect } from 'vitest'
import { stateFromSearch, searchFromState } from '../urlState'
import { DEFAULT_STATE } from '../../state'

describe('urlState', () => {
  it('round-trips', () => {
    const s = { ...DEFAULT_STATE, Z: 26, mode: 'iso' as const, single: false, theme: 'dark' as const, isoFraction: 0.8 }
    const q = searchFromState(s)
    expect(q).toContain('Z=26')
    expect(q).toContain('mode=iso')
    expect(stateFromSearch(q, DEFAULT_STATE)).toMatchObject({ Z: 26, mode: 'iso', single: false, theme: 'dark', isoFraction: 0.8 })
  })
  it('emits only keys that differ from the defaults', () => {
    expect(searchFromState(DEFAULT_STATE)).toBe('')
    expect(searchFromState({ ...DEFAULT_STATE, n: 4 })).toBe('?n=4&l=2&m=0&single=1')
  })
  it('clamps garbage', () => {
    const s = stateFromSearch('?Z=999&n=12&l=9&m=-9&mode=bogus&N=abc&theme=blue&iso=7', DEFAULT_STATE)
    expect(s.Z).toBe(DEFAULT_STATE.Z)
    expect(s).toMatchObject({ n: 7, l: 6, m: -6, mode: DEFAULT_STATE.mode, theme: DEFAULT_STATE.theme })
    expect(s.sphereCount).toBe(DEFAULT_STATE.sphereCount)
    expect(s.isoFraction).toBe(DEFAULT_STATE.isoFraction)
  })
  it('reads N into the count of the selected mode and single=0 as element view', () => {
    const s = stateFromSearch('?Z=6&single=0&mode=glow&N=200000', DEFAULT_STATE)
    expect(s).toMatchObject({ Z: 6, single: false, mode: 'glow', glowCount: 200000 })
    expect(s.sphereCount).toBe(DEFAULT_STATE.sphereCount)
  })
})
