import { describe, it, expect } from 'vitest'
import { deriveParts, visibleSubshells } from '../parts'
import { DEFAULT_STATE } from '../state'
import { SUBSHELL_PALETTE } from '../render/colors'

describe('deriveParts', () => {
  it('single mode: one hydrogen orbital', () => {
    const p = deriveParts({ ...DEFAULT_STATE, single: true, n: 2, l: 1, m: -1 })
    expect(p).toHaveLength(1)
    expect(p[0].orbital).toEqual({ n: 2, l: 1, m: -1, Z: 1, real: true })
    expect(p[0].weight).toBe(1)
  })
  it('element mode: every part has a valid palette color keyed by subshell order', () => {
    const p = deriveParts({ ...DEFAULT_STATE, single: false, Z: 26 })
    expect(p.length).toBe(1 + 1 + 3 + 1 + 3 + 1 + 5)
    for (const part of p) expect(SUBSHELL_PALETTE).toContain(part.color)
    expect(p.find((x) => x.group === '3d')!.color).toBe(SUBSHELL_PALETTE[6])
    expect(p.find((x) => x.group === '3d')!.orbital.Z).toBeCloseTo(6.25, 10)
    expect(p.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1, 10)
  })
  it('valence-only and hidden filters keep the original subshell colors', () => {
    const p = deriveParts({ ...DEFAULT_STATE, single: false, Z: 26, valenceOnly: true, hiddenSubshells: ['4s'] })
    expect(new Set(p.map((x) => x.group))).toEqual(new Set(['3d']))
    expect(p[0].color).toBe(SUBSHELL_PALETTE[6])
    expect(visibleSubshells({ ...DEFAULT_STATE, single: false, Z: 26, valenceOnly: true }).map((s) => s.key)).toEqual(['4s', '3d'])
  })
})
