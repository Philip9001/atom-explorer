import { describe, it, expect } from 'vitest'
import { buildDensityGrid, findThreshold } from '../grid'
import { density } from '../wavefunction'

describe('density grid', () => {
  it('enclosed fraction above threshold matches the request within 1%', () => {
    const g = buildDensityGrid({ n: 2, l: 1, m: 0, Z: 1, real: true }, 64)
    const cell = Math.pow((2 * g.rMax) / g.size, 3)
    let total = 0
    for (let i = 0; i < g.psi.length; i++) total += g.psi[i] * g.psi[i] * cell
    expect(total).toBeGreaterThan(0.99)
    for (const f of [0.5, 0.9]) {
      const thr = findThreshold(g, f)
      let inside = 0
      for (let i = 0; i < g.psi.length; i++) if (g.psi[i] * g.psi[i] >= thr) inside += g.psi[i] * g.psi[i] * cell
      expect(Math.abs(inside / total - f)).toBeLessThan(0.01)
    }
  })
  it('handles degenerate inputs', () => {
    const g = { size: 4, rMax: 1, psi: new Float32Array(64) }
    expect(findThreshold(g, 0.9)).toBe(Infinity)
    const g2 = buildDensityGrid({ n: 1, l: 0, m: 0, Z: 1, real: true }, 16)
    expect(Number.isFinite(findThreshold(g2, 0))).toBe(true)
    expect(Number.isFinite(findThreshold(g2, 1))).toBe(true)
  })
})

describe('density grid for complex orbitals', () => {
  it('is phi-symmetric: psi^2 on the grid equals density() for complex 2p(m=+1)', () => {
    const o = { n: 2, l: 1, m: 1, Z: 1, real: false }
    const g = buildDensityGrid(o, 32)
    const h = (2 * g.rMax) / g.size
    const mid = g.size / 2
    // sample at +x and +y, same radius, z ~ 0
    const ix = g.psi[mid + g.size * (mid + g.size * mid) + 6]
    const iy = g.psi[mid + g.size * (mid + 6 + g.size * mid)]
    expect(ix * ix).toBeGreaterThan(1e-6)
    expect(iy * iy).toBeCloseTo(ix * ix, 9)
    const x = -g.rMax + (mid + 6 + 0.5) * h, z = -g.rMax + (mid + 0.5) * h
    expect(ix * ix).toBeCloseTo(density(o, x, -g.rMax + (mid + 0.5) * h, z), 9)
  })
})
