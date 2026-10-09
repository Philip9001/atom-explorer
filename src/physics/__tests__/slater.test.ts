import { describe, it, expect } from 'vitest'
import { groundStateConfiguration } from '../configuration'
import { slaterZeff } from '../slater'

describe('slaterZeff', () => {
  // Reference values: Slater, Phys. Rev. 36, 57 (1930); standard textbook worked examples.
  it('matches known values', () => {
    expect(slaterZeff(groundStateConfiguration(1), 1, 0)).toBeCloseTo(1, 10)
    expect(slaterZeff(groundStateConfiguration(2), 1, 0)).toBeCloseTo(1.7, 10)
    expect(slaterZeff(groundStateConfiguration(6), 2, 1)).toBeCloseTo(3.25, 10)
    expect(slaterZeff(groundStateConfiguration(11), 3, 0)).toBeCloseTo(2.2, 10)
    expect(slaterZeff(groundStateConfiguration(26), 3, 2)).toBeCloseTo(6.25, 10)
    expect(slaterZeff(groundStateConfiguration(26), 4, 0)).toBeCloseTo(3.75, 10)
    expect(slaterZeff(groundStateConfiguration(30), 4, 0)).toBeCloseTo(4.35, 10)
    // Gd: 6s sees 0.35 + 9*0.85 + 53; 4f sees 6*0.35 + 46
    expect(slaterZeff(groundStateConfiguration(64), 6, 0)).toBeCloseTo(3.0, 10)
    expect(slaterZeff(groundStateConfiguration(64), 4, 3)).toBeCloseTo(15.9, 10)
    // Pb 6p: 3*0.35 + 18*0.85 + 60
    expect(slaterZeff(groundStateConfiguration(82), 6, 1)).toBeCloseTo(5.65, 10)
  })
  it('is at least 1 for every occupied subshell of Z=1..118', () => {
    for (let Z = 1; Z <= 118; Z++) {
      const cfg = groundStateConfiguration(Z)
      for (const s of cfg) expect(slaterZeff(cfg, s.n, s.l)).toBeGreaterThanOrEqual(1)
    }
  })
})
