import { describe, it, expect } from 'vitest'
import { radialR } from '../radial'
import { simpson } from '../quadrature'

function countSignChanges(f: (r: number) => number, a: number, b: number, steps: number): number {
  let changes = 0
  let prev = f(a + (b - a) / steps)
  for (let i = 2; i < steps; i++) {
    const v = f(a + ((b - a) * i) / steps)
    if (v * prev < 0) changes++
    if (v !== 0) prev = v
  }
  return changes
}

describe('radialR', () => {
  it('R_10(0) = 2 Z^(3/2)', () => {
    expect(radialR(1, 0, 1, 0)).toBeCloseTo(2, 12)
    expect(radialR(1, 0, 3, 0)).toBeCloseTo(2 * Math.pow(3, 1.5), 10)
  })
  it('R_21 matches Griffiths Table 4.7: (1/(2 sqrt6)) Z^(3/2) (Z r) e^{-Zr/2}', () => {
    const Z = 2, r = 1.3
    const expected = (1 / (2 * Math.sqrt(6))) * Math.pow(Z, 1.5) * (Z * r) * Math.exp(-Z * r / 2)
    expect(radialR(2, 1, Z, r)).toBeCloseTo(expected, 12)
  })
  it('integral r^2 R^2 dr = 1 for all n<=7, l<n, Z in {1, 2.2, 6.25}', () => {
    for (const Z of [1, 2.2, 6.25]) {
      for (let n = 1; n <= 7; n++) {
        for (let l = 0; l < n; l++) {
          const rMax = (40 * n * n) / Z
          const I = simpson((r) => r * r * radialR(n, l, Z, r) ** 2, 0, rMax, 4000)
          expect(Math.abs(I - 1), `n=${n} l=${l} Z=${Z}`).toBeLessThan(1e-3)
        }
      }
    }
  })
  it('has n-l-1 radial nodes', () => {
    for (let n = 1; n <= 7; n++) {
      for (let l = 0; l < n; l++) {
        const rMax = 8 * n * n
        expect(countSignChanges((r) => radialR(n, l, 1, r), 0, rMax, 20000), `n=${n} l=${l}`).toBe(n - l - 1)
      }
    }
  })
})
