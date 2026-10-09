/**
 * Generalized (associated) Laguerre polynomial L^alpha_k(x).
 * Three-term recurrence, Abramowitz & Stegun 22.7.12:
 *   (k+1) L_{k+1} = (2k+1+alpha-x) L_k - (k+alpha) L_{k-1}
 * with L_0 = 1, L_1 = 1 + alpha - x. Convention: leading coefficient (-1)^k / k!.
 */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1
  let prev = 1
  let cur = 1 + alpha - x
  for (let i = 1; i < k; i++) {
    const next = ((2 * i + 1 + alpha - x) * cur - (i + alpha) * prev) / (i + 1)
    prev = cur
    cur = next
  }
  return cur
}
