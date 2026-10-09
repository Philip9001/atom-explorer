import { describe, it, expect } from 'vitest'
import { GlowCloud } from '../glowCloud'
import { COLORMAPS } from '../../physics/colormaps'

describe('GlowCloud', () => {
  it('colors points by normalized density through the colormap with a gamma curve', () => {
    const cloud = new GlowCloud(4)
    const positions = new Float32Array([0, 0, 0, 1, 1, 1])
    const psi = new Float32Array([1, 0.5]) // densities 1 and 0.25
    cloud.update(positions, psi, 1, COLORMAPS.inferno, 0.5)
    const c = cloud.points.geometry.getAttribute('color').array as Float32Array
    // t = 1 -> last LUT entry (near white); t = sqrt(0.25) = 0.5 -> mid entry
    expect(c[0] + c[1] + c[2]).toBeGreaterThan(2.5)
    const mid = 128 * 3
    expect(c[3]).toBeCloseTo(COLORMAPS.inferno[mid], 1)
    expect(cloud.points.geometry.drawRange.count).toBe(2)
  })
  it('scales opacity down as the count grows', () => {
    const cloud = new GlowCloud(10)
    cloud.setCount(100)
    const a = cloud.material.opacity
    cloud.setCount(10000)
    expect(cloud.material.opacity).toBeLessThan(a)
    expect(cloud.material.opacity).toBeGreaterThan(0)
  })
  it('setColormap recolors from cached psi without new positions', () => {
    const cloud = new GlowCloud(4)
    cloud.update(new Float32Array(3), new Float32Array([1]), 1, COLORMAPS.inferno, 1)
    cloud.setColormap(COLORMAPS.viridis, 1)
    const c = cloud.points.geometry.getAttribute('color').array as Float32Array
    expect(c[0]).toBeCloseTo(COLORMAPS.viridis[255 * 3], 3)
  })
})
