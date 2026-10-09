import { factorial } from './factorial'
import { legendreP } from './legendre'

/** N_lm = sqrt( (2l+1)/(4 pi) (l-|m|)! / (l+|m|)! ), Griffiths eq. 4.32. */
export function angularNorm(l: number, m: number): number {
  const am = Math.abs(m)
  return Math.sqrt((((2 * l + 1) / (4 * Math.PI)) * factorial(l - am)) / factorial(l + am))
}

/**
 * Real spherical harmonics (tesseral harmonics), Blanco, Florez & Bermejo,
 * J. Mol. Struct. THEOCHEM 419 (1997) 19, eq. 3, written without the
 * Condon-Shortley phase so px, py, pz are positive along +x, +y, +z:
 *   m > 0:  sqrt2 N_lm   P_l^m(cos t)   cos(m phi)     (x-type)
 *   m = 0:        N_l0   P_l^0(cos t)
 *   m < 0:  sqrt2 N_l|m| P_l^|m|(cos t) sin(|m| phi)   (y-type)
 */
export function realY(l: number, m: number, cosTheta: number, phi: number): number {
  const am = Math.abs(m)
  const base = angularNorm(l, m) * legendreP(l, am, cosTheta)
  if (m === 0) return base
  return m > 0 ? Math.SQRT2 * base * Math.cos(am * phi) : Math.SQRT2 * base * Math.sin(am * phi)
}

/** Complex Y_lm = N_lm P_l^|m|(cos t) e^{i m phi} (Condon-Shortley phase omitted; |Y|^2 is unaffected). */
export function complexY(l: number, m: number, cosTheta: number, phi: number): { re: number; im: number } {
  const base = angularNorm(l, m) * legendreP(l, Math.abs(m), cosTheta)
  return { re: base * Math.cos(m * phi), im: base * Math.sin(m * phi) }
}
