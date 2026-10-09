import type { Orbital } from './orbital'
import { radialR } from './radial'
import { simpson } from './quadrature'

/** Probability enclosed inside radius rMax: integral_0^rMax r^2 R_nl^2 dr. */
export function radialCdfEnclosed(n: number, l: number, Z: number, rMax: number): number {
  return simpson((r) => r * r * radialR(n, l, Z, r) ** 2, 0, rMax, 2000)
}

/**
 * Box half-size for sampling/gridding: start at 2.5 n^2 / Z (about 1.7x the
 * hydrogenic mean radius <r> = (3n^2 - l(l+1)) / (2Z), Griffiths problem 4.13)
 * and grow by 25% until more than 99.5% of the radial probability is enclosed.
 */
export function orbitalExtent(o: Orbital): number {
  let r = (2.5 * o.n * o.n) / o.Z
  for (let i = 0; i < 40 && radialCdfEnclosed(o.n, o.l, o.Z, r) < 0.995; i++) r *= 1.25
  return r
}
