import { describe, it, expect } from 'vitest'
import { realY, complexY } from '../harmonics'
import { simpson } from '../quadrature'

/** Integral over the unit sphere of f(cosTheta, phi). */
function sphereIntegral(f: (ct: number, phi: number) => number): number {
  return simpson((ct) => simpson((phi) => f(ct, phi), 0, 2 * Math.PI, 400), -1, 1, 400)
}

describe('realY', () => {
  it('is normalized on the sphere for all l<=6, |m|<=l', () => {
    for (let l = 0; l <= 6; l++) {
      for (let m = -l; m <= l; m++) {
        const I = sphereIntegral((ct, phi) => realY(l, m, ct, phi) ** 2)
        expect(Math.abs(I - 1), `l=${l} m=${m}`).toBeLessThan(1e-3)
      }
    }
  })
  it('pairs are orthogonal', () => {
    const pairs: [number, number, number, number][] = [[1, 0, 1, 1], [2, 2, 2, -2], [2, 0, 0, 0], [3, 1, 1, 1]]
    for (const [l1, m1, l2, m2] of pairs) {
      const I = sphereIntegral((ct, phi) => realY(l1, m1, ct, phi) * realY(l2, m2, ct, phi))
      expect(Math.abs(I)).toBeLessThan(1e-3)
    }
  })
  it('uses the standard real-orbital naming: m=+1 is x-type, m=-1 is y-type, m=0 is z-type', () => {
    expect(realY(1, 1, 0, 0)).toBeGreaterThan(0) // px at (1,0,0)
    expect(realY(1, -1, 0, Math.PI / 2)).toBeGreaterThan(0) // py at (0,1,0)
    expect(realY(1, 0, 1, 0)).toBeGreaterThan(0) // pz at (0,0,1)
    expect(realY(1, 1, 0, Math.PI / 2)).toBeCloseTo(0, 12) // px vanishes on y axis
    expect(realY(0, 0, 0.3, 1.1)).toBeCloseTo(1 / Math.sqrt(4 * Math.PI), 12)
  })
  it('has l - |m| nodes in theta and |m| nodal planes in phi', () => {
    for (let l = 0; l <= 4; l++) {
      for (let m = -l; m <= l; m++) {
        const phi0 = 0.123
        let thetaChanges = 0
        let prev = realY(l, m, Math.cos(0.001), phi0)
        for (let i = 2; i < 2000; i++) {
          const v = realY(l, m, Math.cos((Math.PI * i) / 2000), phi0)
          if (v * prev < 0) thetaChanges++
          if (v !== 0) prev = v
        }
        expect(thetaChanges, `theta l=${l} m=${m}`).toBe(l - Math.abs(m))
        // Count sign changes around the full circle (wrapping), so a zero
        // sitting exactly at phi = 0 (sin-type orbitals) is counted once.
        let phiChanges = 0
        const ct0 = 0.37
        prev = realY(l, m, ct0, 0.001)
        for (let i = 1; i <= 2000; i++) {
          const v = realY(l, m, ct0, 0.001 + (2 * Math.PI * i) / 2000)
          if (v * prev < 0) phiChanges++
          if (v !== 0) prev = v
        }
        expect(phiChanges, `phi l=${l} m=${m}`).toBe(2 * Math.abs(m))
      }
    }
  })
})

describe('complexY', () => {
  it('|Y|^2 is normalized and independent of phi', () => {
    const I = sphereIntegral((ct, phi) => {
      const y = complexY(2, 1, ct, phi)
      return y.re ** 2 + y.im ** 2
    })
    expect(Math.abs(I - 1)).toBeLessThan(1e-3)
    const a = complexY(3, 2, 0.4, 0.2), b = complexY(3, 2, 0.4, 2.9)
    expect(a.re ** 2 + a.im ** 2).toBeCloseTo(b.re ** 2 + b.im ** 2, 12)
  })
})
