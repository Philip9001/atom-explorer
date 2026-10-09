import type { Orbital } from './orbital'
import { density } from './wavefunction'

/**
 * Total density on the x-z plane (y = 0, which contains the z symmetry axis),
 * summed over parts with their weights and normalized to a maximum of 1.
 * Row index j is z (bottom to top), column i is x, both spanning [-half, half].
 */
export function sliceDensity(parts: { orbital: Orbital; weight: number }[], size: number, half: number): Float32Array {
  const out = new Float32Array(size * size)
  if (parts.length === 0 || size < 2) return out
  const h = (2 * half) / (size - 1)
  let max = 0
  for (let j = 0; j < size; j++) {
    const z = -half + j * h
    for (let i = 0; i < size; i++) {
      const x = -half + i * h
      let d = 0
      for (const p of parts) d += p.weight * density(p.orbital, x, 0, z)
      out[j * size + i] = d
      if (d > max) max = d
    }
  }
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max
  return out
}
