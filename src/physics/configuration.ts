import { SUBSHELL_LETTERS } from './orbital'

export interface Subshell {
  n: number
  l: number
  electrons: number
}

/** Madelung (n+l, then n) filling order; aufbau principle (Atkins, Physical Chemistry). */
export const MADELUNG_ORDER: readonly { n: number; l: number }[] = (() => {
  const out: { n: number; l: number }[] = []
  for (let n = 1; n <= 8; n++) for (let l = 0; l < n; l++) out.push({ n, l })
  return out.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n)
})()

/**
 * Elements whose ground state breaks the Madelung rule (NIST Atomic Spectra
 * Database ground levels): [n, l, electrons] overrides. Z <= 36 needs only Cr and Cu;
 * the heavier d-block entries are included for a later range extension.
 */
const EXCEPTIONS: Record<number, [number, number, number][]> = {
  24: [[4, 0, 1], [3, 2, 5]],
  29: [[4, 0, 1], [3, 2, 10]],
  41: [[5, 0, 1], [4, 2, 4]],
  42: [[5, 0, 1], [4, 2, 5]],
  44: [[5, 0, 1], [4, 2, 7]],
  45: [[5, 0, 1], [4, 2, 8]],
  46: [[5, 0, 0], [4, 2, 10]],
  47: [[5, 0, 1], [4, 2, 10]],
  78: [[6, 0, 1], [5, 2, 9]],
  79: [[6, 0, 1], [5, 2, 10]],
}

export function groundStateConfiguration(Z: number): Subshell[] {
  const cfg: Subshell[] = []
  let left = Z
  for (const { n, l } of MADELUNG_ORDER) {
    if (left <= 0) break
    const take = Math.min(left, 2 * (2 * l + 1))
    cfg.push({ n, l, electrons: take })
    left -= take
  }
  for (const [n, l, e] of EXCEPTIONS[Z] ?? []) {
    const s = cfg.find((x) => x.n === n && x.l === l)
    if (s) s.electrons = e
    else cfg.push({ n, l, electrons: e })
  }
  return cfg.filter((s) => s.electrons > 0)
}

export function configurationString(cfg: Subshell[]): string {
  return cfg.map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`).join(' ')
}

/** Electrons per shell, index n-1 (K, L, M, ...). */
export function shellCounts(cfg: Subshell[]): number[] {
  const out: number[] = []
  for (const s of cfg) out[s.n - 1] = (out[s.n - 1] ?? 0) + s.electrons
  for (let i = 0; i < out.length; i++) out[i] ??= 0
  return out
}

/** Valence: subshells of the highest n, plus a partially filled (n-1)d subshell. */
export function isValenceSubshell(cfg: Subshell[], s: Subshell): boolean {
  const nMax = Math.max(...cfg.map((x) => x.n))
  if (s.n === nMax) return true
  return s.l === 2 && s.n === nMax - 1 && s.electrons < 10
}

/** Hund's rule filling across real orbitals in the order m = 0, +1, -1, +2, -2, ... */
export function occupiedOrbitals(s: Subshell): { m: number; electrons: number }[] {
  const ms: number[] = [0]
  for (let m = 1; m <= s.l; m++) ms.push(m, -m)
  const occ = ms.map((m) => ({ m, electrons: 0 }))
  for (let e = 0; e < s.electrons; e++) occ[e % ms.length].electrons++
  return occ.filter((o) => o.electrons > 0)
}
