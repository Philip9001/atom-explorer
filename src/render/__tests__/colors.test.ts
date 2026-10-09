import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { phaseShades, SUBSHELL_PALETTE } from '../colors'

describe('phaseShades', () => {
  it('returns a lighter positive and darker negative shade of the base', () => {
    const { pos, neg } = phaseShades('#2a9d8f')
    const hsl = { h: 0, s: 0, l: 0 }
    const l0 = new THREE.Color('#2a9d8f').getHSL(hsl).l // same (linear) color space as the shades
    expect(pos.getHSL(hsl).l).toBeGreaterThan(l0)
    expect(neg.getHSL(hsl).l).toBeLessThan(l0)
  })
  it('has twenty distinct palette colors (oganesson has 19 subshells)', () => {
    expect(new Set(SUBSHELL_PALETTE).size).toBe(20)
  })
})
