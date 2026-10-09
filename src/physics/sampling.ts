import type { Orbital } from './orbital'
import { radialR } from './radial'
import { angularNorm } from './harmonics'
import { legendreP } from './legendre'
import { orbitalExtent } from './extent'
import { mulberry32 } from './rng'

export interface InverseCdf {
  x: Float32Array
  cdf: Float32Array
}

/** Tabulate density f on [a,b] at `size` points, cumulative trapezoid, normalized to 1. */
export function buildInverseCdf(f: (x: number) => number, a: number, b: number, size: number): InverseCdf {
  const x = new Float32Array(size)
  const cdf = new Float32Array(size)
  const h = (b - a) / (size - 1)
  let acc = 0
  let prev = Math.max(0, f(a))
  x[0] = a
  cdf[0] = 0
  for (let i = 1; i < size; i++) {
    const xi = a + i * h
    const fi = Math.max(0, f(xi))
    acc += 0.5 * (prev + fi) * h
    x[i] = xi
    cdf[i] = acc
    prev = fi
  }
  for (let i = 1; i < size; i++) cdf[i] /= acc
  return { x, cdf }
}

/** Inverse transform sampling with linear interpolation between nodes (Devroye 1986, ch. II.2). */
export function sampleInverseCdf(t: InverseCdf, u: number): number {
  const { x, cdf } = t
  let lo = 0
  let hi = cdf.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cdf[mid] <= u) lo = mid
    else hi = mid
  }
  const span = cdf[hi] - cdf[lo]
  const f = span > 0 ? (u - cdf[lo]) / span : 0
  return x[lo] + (x[hi] - x[lo]) * f
}

export interface SampleResult {
  /** xyz triples in atomic units. */
  positions: Float32Array
  /** Signed psi at each sample (real part for complex orbitals). */
  psi: Float32Array
  /** Upper bound of |psi|^2 over the orbital, for colormap normalization. */
  maxDensity: number
  /** Box half-size that encloses >99.5% of the probability. */
  rMax: number
}

/**
 * Sample |psi|^2 = r^2 R^2(r) |Y|^2(cos t, phi), which for a single hydrogenic
 * orbital (real or complex) factorizes into three independent 1D densities:
 *   radial  : r^2 R_nl^2(r)                       on [0, rMax]
 *   polar   : [N_lm P_l^|m|(cos t)]^2 in cos t    on [-1, 1]  (measure sin t dt = d cos t)
 *   azimuth : cos^2(m phi), sin^2(|m| phi), or 1   on [0, 2 pi]
 * Each is inverse-CDF sampled from a table; no rejection sampling is used.
 */
export function sampleOrbital(o: Orbital, count: number, seed: number): SampleResult {
  const rMax = orbitalExtent(o)
  const am = Math.abs(o.m)
  const norm = angularNorm(o.l, o.m)
  const radialDensity = (r: number) => { const R = radialR(o.n, o.l, o.Z, r); return r * r * R * R }
  const polarDensity = (ct: number) => { const p = norm * legendreP(o.l, am, ct); return p * p }
  const azimuthDensity = (phi: number) =>
    o.real && o.m > 0 ? Math.cos(am * phi) ** 2 : o.real && o.m < 0 ? Math.sin(am * phi) ** 2 : 1

  const radial = buildInverseCdf(radialDensity, 0, rMax, 4096)
  const polar = buildInverseCdf(polarDensity, -1, 1, 2048)
  const azimuth = buildInverseCdf(azimuthDensity, 0, 2 * Math.PI, 2048)

  // max |psi|^2 <= max R^2 * max [N P]^2 * (2 for real m != 0, else 1)
  let maxR2 = 0
  for (let i = 0; i < radial.x.length; i++) { const R = radialR(o.n, o.l, o.Z, radial.x[i]); maxR2 = Math.max(maxR2, R * R) }
  let maxP2 = 0
  for (let i = 0; i < polar.x.length; i++) maxP2 = Math.max(maxP2, polarDensity(polar.x[i]))
  const maxDensity = maxR2 * maxP2 * (o.real && o.m !== 0 ? 2 : 1)

  const rng = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const psi = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = sampleInverseCdf(radial, rng())
    const ct = sampleInverseCdf(polar, rng())
    const phi = sampleInverseCdf(azimuth, rng())
    const st = Math.sqrt(Math.max(0, 1 - ct * ct))
    positions[3 * i] = r * st * Math.cos(phi)
    positions[3 * i + 1] = r * st * Math.sin(phi)
    positions[3 * i + 2] = r * ct
    const R = radialR(o.n, o.l, o.Z, r)
    const P = norm * legendreP(o.l, am, ct)
    const A = !o.real || o.m === 0 ? 1 : o.m > 0 ? Math.SQRT2 * Math.cos(am * phi) : Math.SQRT2 * Math.sin(am * phi)
    psi[i] = R * P * A
  }
  return { positions, psi, maxDensity, rMax }
}
