import { describe, it, expect } from 'vitest'
import { density, psi } from '../wavefunction'
import { orbitalExtent, radialCdfEnclosed } from '../extent'
import { clampOrbital, isValidOrbital, realOrbitalName, orbitalLabel } from '../orbital'
import { simpson } from '../quadrature'

describe('psi', () => {
  it('|psi|^2 integrates to 1 over space (1s, 2pz, 3dxy, 4fz3)', () => {
    const cases = [
      { n: 1, l: 0, m: 0 }, { n: 2, l: 1, m: 0 }, { n: 3, l: 2, m: -2 }, { n: 4, l: 3, m: 0 },
    ]
    for (const c of cases) {
      const o = { ...c, Z: 1.5, real: true }
      const rMax = orbitalExtent(o) * 1.6
      const I = simpson((r) => r * r * simpson((ct) => simpson((phi) => {
        const st = Math.sqrt(1 - ct * ct)
        return density(o, r * st * Math.cos(phi), r * st * Math.sin(phi), r * ct)
      }, 0, 2 * Math.PI, 48), -1, 1, 48), 0, rMax, 400)
      expect(Math.abs(I - 1), JSON.stringify(c)).toBeLessThan(2e-3)
    }
  })
  it('2pz is antisymmetric in z', () => {
    const o = { n: 2, l: 1, m: 0, Z: 1, real: true }
    expect(psi(o, 0.3, 0.2, 1.1)).toBeCloseTo(-psi(o, 0.3, 0.2, -1.1), 12)
  })
})

describe('extent', () => {
  it('encloses at least 99.5% probability', () => {
    for (const o of [
      { n: 1, l: 0, m: 0, Z: 1, real: true },
      { n: 4, l: 2, m: 0, Z: 3.75, real: true },
      { n: 7, l: 0, m: 0, Z: 1, real: true },
    ]) {
      const r = orbitalExtent(o)
      expect(radialCdfEnclosed(o.n, o.l, o.Z, r)).toBeGreaterThan(0.995)
      expect(radialCdfEnclosed(o.n, o.l, o.Z, r / 1.25)).toBeLessThan(0.9995)
    }
  })
})

describe('orbital helpers', () => {
  it('validates and clamps', () => {
    expect(isValidOrbital({ n: 3, l: 2, m: -2 })).toBe(true)
    expect(isValidOrbital({ n: 3, l: 3, m: 0 })).toBe(false)
    expect(isValidOrbital({ n: 8, l: 0, m: 0 })).toBe(false)
    expect(clampOrbital(9, 5, 9)).toEqual({ n: 7, l: 5, m: 5 })
    expect(clampOrbital(2, 3, -4)).toEqual({ n: 2, l: 1, m: -1 })
    expect(clampOrbital(NaN, NaN, NaN)).toEqual({ n: 1, l: 0, m: 0 })
  })
  it('names real orbitals', () => {
    expect(realOrbitalName(1, 1)).toBe('px')
    expect(realOrbitalName(2, 0)).toBe('dz2')
    expect(realOrbitalName(2, 2)).toBe('dx2-y2')
    expect(orbitalLabel({ n: 3, l: 2, m: -2, Z: 1, real: true })).toBe('3dxy')
  })
})
