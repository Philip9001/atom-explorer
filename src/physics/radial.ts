import { factorial } from './factorial'
import { laguerre } from './laguerre'

/**
 * Hydrogen-like radial function in atomic units (a0 = 1), Griffiths QM 2nd ed. eq. 4.89:
 *   R_nl(r) = sqrt( (2Z/n)^3 (n-l-1)! / (2n (n+l)!) ) e^{-rho/2} rho^l L^{2l+1}_{n-l-1}(rho),
 *   rho = 2 Z r / n,
 * with the Laguerre convention of Abramowitz & Stegun (leading coefficient (-1)^k/k!),
 * which is what laguerre() implements. Normalized so that integral r^2 R^2 dr = 1.
 */
export function radialNorm(n: number, l: number, Z: number): number {
  return Math.sqrt((Math.pow((2 * Z) / n, 3) * factorial(n - l - 1)) / (2 * n * factorial(n + l)))
}

export function radialR(n: number, l: number, Z: number, r: number): number {
  const rho = (2 * Z * r) / n
  return radialNorm(n, l, Z) * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre(n - l - 1, 2 * l + 1, rho)
}
