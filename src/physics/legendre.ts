/**
 * Associated Legendre function P_l^m(x) for m >= 0, |x| <= 1, WITHOUT the
 * Condon-Shortley phase (-1)^m. Recurrences from Numerical Recipes 3rd ed. 6.7:
 *   P_m^m     = (2m-1)!! (1-x^2)^{m/2}
 *   P_{m+1}^m = x (2m+1) P_m^m
 *   (l-m) P_l^m = x (2l-1) P_{l-1}^m - (l+m-1) P_{l-2}^m
 */
export function legendreP(l: number, m: number, x: number): number {
  if (m < 0 || m > l) throw new RangeError(`legendreP(${l},${m})`)
  let pmm = 1
  if (m > 0) {
    const somx2 = Math.sqrt((1 - x) * (1 + x))
    let fact = 1
    for (let i = 1; i <= m; i++) {
      pmm *= fact * somx2
      fact += 2
    }
  }
  if (l === m) return pmm
  let pmmp1 = x * (2 * m + 1) * pmm
  if (l === m + 1) return pmmp1
  let pll = 0
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m)
    pmm = pmmp1
    pmmp1 = pll
  }
  return pll
}
