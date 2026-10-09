import { describe, it, expect } from 'vitest'
import { sampleOrbital } from '../sampling'

describe('sampleOrbital', () => {
  it('1s: mean r = 1.5/Z within 1%', () => {
    const Z = 2
    const { positions } = sampleOrbital({ n: 1, l: 0, m: 0, Z, real: true }, 200000, 1)
    let sum = 0
    for (let i = 0; i < positions.length; i += 3) sum += Math.hypot(positions[i], positions[i + 1], positions[i + 2])
    const mean = sum / (positions.length / 3)
    expect(Math.abs(mean - 1.5 / Z) / (1.5 / Z)).toBeLessThan(0.01)
  })
  it('2pz: symmetric about z=0, almost nothing in the nodal plane, psi sign matches z', () => {
    const { positions, psi } = sampleOrbital({ n: 2, l: 1, m: 0, Z: 1, real: true }, 100000, 7)
    let up = 0, near = 0, signOk = 0
    const N = positions.length / 3
    for (let i = 0; i < N; i++) {
      const z = positions[3 * i + 2]
      if (z > 0) up++
      if (Math.abs(z) < 0.05 * Math.hypot(positions[3 * i], positions[3 * i + 1], z)) near++
      if (z > 0 === psi[i] > 0) signOk++
    }
    expect(Math.abs(up / N - 0.5)).toBeLessThan(0.01)
    expect(near / N).toBeLessThan(0.002)
    expect(signOk).toBe(N)
  })
  it('is deterministic for a seed and reports maxDensity >= every sample density', () => {
    const o = { n: 3, l: 2, m: 2, Z: 1.3, real: true }
    const a = sampleOrbital(o, 1000, 42), b = sampleOrbital(o, 1000, 42)
    expect(a.positions).toEqual(b.positions)
    for (let i = 0; i < 1000; i++) expect(a.psi[i] * a.psi[i]).toBeLessThanOrEqual(a.maxDensity * 1.0001)
  })
})
