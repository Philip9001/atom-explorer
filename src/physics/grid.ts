import type { Orbital } from './orbital'
import { orbitalExtent } from './extent'
import { psiSigned } from './wavefunction'

export interface DensityGrid {
  size: number
  /** Box half-size; cells cover [-rMax, rMax]^3. */
  rMax: number
  /** Signed sqrt(|psi|^2) at cell centers (see psiSigned), size^3 values, x fastest. */
  psi: Float32Array
}

export const gridIndex = (size: number, i: number, j: number, k: number): number => i + size * (j + size * k)

export function buildDensityGrid(o: Orbital, size: number): DensityGrid {
  const rMax = orbitalExtent(o)
  const h = (2 * rMax) / size
  const out = new Float32Array(size * size * size)
  for (let k = 0; k < size; k++) {
    const z = -rMax + (k + 0.5) * h
    for (let j = 0; j < size; j++) {
      const y = -rMax + (j + 0.5) * h
      for (let i = 0; i < size; i++) out[gridIndex(size, i, j, k)] = psiSigned(o, -rMax + (i + 0.5) * h, y, z)
    }
  }
  return { size, rMax, psi: out }
}

/**
 * Density threshold enclosing `fraction` of the grid's total probability:
 * sort cell densities descending and accumulate until the fraction is reached.
 * Returns Infinity for an all-zero grid (no surface).
 */
export function findThreshold(grid: DensityGrid, fraction: number): number {
  const f = Math.min(0.999, Math.max(0.01, fraction))
  const d = new Float32Array(grid.psi.length)
  let total = 0
  for (let i = 0; i < d.length; i++) {
    d[i] = grid.psi[i] * grid.psi[i]
    total += d[i]
  }
  if (total === 0) return Infinity
  d.sort().reverse()
  let acc = 0
  for (let i = 0; i < d.length; i++) {
    acc += d[i]
    if (acc >= f * total) return d[i]
  }
  return d[d.length - 1]
}
