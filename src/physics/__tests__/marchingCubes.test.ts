import { describe, it, expect } from 'vitest'
import { marchingCubes } from '../marchingCubes'
import { gridIndex } from '../grid'

function triangleArea(p: Float32Array, i: number): number {
  const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2]
  const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2]
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx
  return 0.5 * Math.hypot(cx, cy, cz)
}

describe('marchingCubes', () => {
  it('a radial gaussian field gives a sphere whose area is within 3% of 4 pi r^2', () => {
    const size = 64, rMax = 2
    const psi = new Float32Array(size ** 3)
    const h = (2 * rMax) / size
    for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -rMax + (i + 0.5) * h, y = -rMax + (j + 0.5) * h, z = -rMax + (k + 0.5) * h
      psi[gridIndex(size, i, j, k)] = Math.exp(-(x * x + y * y + z * z) / 2) // psi^2 = e^{-r^2}
    }
    const r0 = 1.1
    const mesh = marchingCubes({ size, rMax, psi }, Math.exp(-r0 * r0))
    let area = 0
    for (let i = 0; i < mesh.positions.length; i += 9) area += triangleArea(mesh.positions, i)
    expect(Math.abs(area / (4 * Math.PI * r0 * r0) - 1)).toBeLessThan(0.03)
    expect(mesh.normals.length).toBe(mesh.positions.length)
    expect(mesh.signs.length).toBe(mesh.positions.length / 3)
    // normals point outward: dot(n, p) > 0 on a sphere about the origin
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const d = mesh.normals[i] * mesh.positions[i] + mesh.normals[i + 1] * mesh.positions[i + 1] + mesh.normals[i + 2] * mesh.positions[i + 2]
      expect(d).toBeGreaterThan(0)
    }
    // triangle winding is counter-clockwise seen from outside (face normal agrees with gradient normal)
    let agree = 0, total = 0
    for (let i = 0; i < mesh.positions.length; i += 9) {
      const p = mesh.positions
      const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2]
      const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2]
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx
      if (cx * mesh.normals[i] + cy * mesh.normals[i + 1] + cz * mesh.normals[i + 2] > 0) agree++
      total++
    }
    expect(agree / total).toBeGreaterThan(0.99)
  })
  it('returns an empty mesh when nothing crosses the threshold', () => {
    const mesh = marchingCubes({ size: 8, rMax: 1, psi: new Float32Array(512) }, 0.5)
    expect(mesh.positions.length).toBe(0)
    const inf = marchingCubes({ size: 8, rMax: 1, psi: new Float32Array(512).fill(1) }, Infinity)
    expect(inf.positions.length).toBe(0)
  })
})
