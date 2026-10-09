import type { Subshell } from './configuration'

/**
 * Slater's rules, J. C. Slater, Phys. Rev. 36, 57 (1930), as summarized in
 * inorganic chemistry texts (e.g. Miessler & Tarr). Groups, left to right:
 *   [1s] [2s2p] [3s3p] [3d] [4s4p] [4d] [4f] [5s5p] [5d] [5f] [6s6p] ...
 * For an electron in an [ns np] group: others in the same group shield 0.35
 * (0.30 inside 1s); electrons with principal quantum number n-1 shield 0.85;
 * n-2 or lower shield 1.00. For an [nd] or [nf] electron: same group 0.35,
 * every electron in a group to the left 1.00. Groups to the right shield 0.
 */
function groupKey(n: number, l: number): number {
  // s and p share a group; d and f groups come after the sp group of the same n.
  return n * 10 + (l <= 1 ? 0 : l)
}

export function slaterShielding(cfg: Subshell[], n: number, l: number): number {
  const key = groupKey(n, l)
  let S = 0
  for (const s of cfg) {
    const k = groupKey(s.n, s.l)
    let count = s.electrons
    if (k === key) {
      if (s.n === n && s.l === l) count -= 1 // exclude the electron itself
      S += count * (n === 1 ? 0.3 : 0.35)
    } else if (k < key) {
      if (l <= 1) S += count * (s.n <= n - 2 ? 1.0 : 0.85)
      else S += count * 1.0
    }
  }
  return S
}

export function slaterZeff(cfg: Subshell[], n: number, l: number): number {
  const Z = cfg.reduce((a, s) => a + s.electrons, 0)
  return Math.max(1, Z - slaterShielding(cfg, n, l))
}
