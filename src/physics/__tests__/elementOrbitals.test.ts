import { describe, it, expect } from 'vitest'
import { elementSubshells, allocateCounts } from '../elementOrbitals'

describe('elementSubshells', () => {
  it('Fe has 7 subshells with Slater Zeff and valence flags', () => {
    const s = elementSubshells(26)
    expect(s.map((x) => x.key)).toEqual(['1s', '2s', '2p', '3s', '3p', '4s', '3d'])
    expect(s.find((x) => x.key === '3d')!.Zeff).toBeCloseTo(6.25, 10)
    expect(s.filter((x) => x.valence).map((x) => x.key)).toEqual(['4s', '3d'])
    expect(s.find((x) => x.key === '3d')!.orbitals.length).toBe(5)
    expect(s.find((x) => x.key === '3d')!.electrons).toBe(6)
  })
  it('allocates counts proportional to electrons with a floor', () => {
    const counts = allocateCounts(elementSubshells(36), 50000)
    for (const v of counts.values()) expect(v).toBeGreaterThanOrEqual(500)
    expect(counts.get('1,0,0')!).toBeLessThan(counts.get('4,1,0')! * 2)
    expect(counts.size).toBe(1 + 1 + 3 + 1 + 3 + 1 + 5 + 3)
    // Hydrogen: one orbital gets the whole budget
    expect(allocateCounts(elementSubshells(1), 1234).get('1,0,0')).toBe(1234)
  })
})
