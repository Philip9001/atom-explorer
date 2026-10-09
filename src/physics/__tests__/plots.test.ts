import { describe, it, expect } from 'vitest'
import { sliceDensity } from '../slice'
import { radialCurve } from '../radialCurve'

describe('sliceDensity', () => {
  it('samples the x-z plane, normalized to a max of 1, and is zero on the 2pz nodal plane', () => {
    const o = { n: 2, l: 1, m: 0, Z: 1, real: true }
    const size = 33, half = 10
    const d = sliceDensity([{ orbital: o, weight: 1 }], size, half)
    expect(d.length).toBe(size * size)
    let max = 0
    for (const v of d) max = Math.max(max, v)
    expect(max).toBeCloseTo(1, 6)
    // middle row is z = 0 (the nodal plane of 2pz): all zero
    const mid = Math.floor(size / 2)
    for (let i = 0; i < size; i++) expect(d[mid * size + i]).toBeCloseTo(0, 9)
    // symmetric in z
    expect(d[(mid + 5) * size + mid + 3]).toBeCloseTo(d[(mid - 5) * size + mid + 3], 9)
  })
  it('weights parts and returns zeros for an empty part list', () => {
    expect(Array.from(sliceDensity([], 4, 1))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('radialCurve', () => {
  it('returns r and r^2 R^2 with the 1s peak at r = 1/Z', () => {
    const c = radialCurve(1, 0, 2, 5, 501)
    expect(c.r.length).toBe(501)
    let best = 0
    for (let i = 1; i < c.r.length; i++) if (c.y[i] > c.y[best]) best = i
    expect(c.r[best]).toBeCloseTo(0.5, 2)
  })
})
