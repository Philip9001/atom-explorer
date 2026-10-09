import type { Orbital } from './physics/orbital'
import { elementSubshells, allocateCounts, type SubshellView } from './physics/elementOrbitals'
import { SUBSHELL_PALETTE } from './render/colors'
import type { AppState } from './state'

/** One orbital contributing to the view, with its color and share of the sample budget. */
export interface OrbitalPart {
  orbital: Orbital
  color: string
  weight: number
  /** Subshell key ('3d'); isosurfaces are drawn once per group. */
  group: string
}

export const SINGLE_COLOR = '#2a9d8f'

/** Subshells of the current element after the valence / hidden filters (empty in single mode). */
export function visibleSubshells(s: AppState): SubshellView[] {
  if (s.single) return []
  return elementSubshells(s.Z).filter((sub) => (!s.valenceOnly || sub.valence) && !s.hiddenSubshells.includes(sub.key))
}

/** Palette color of a subshell: fixed by its position in the element's configuration. */
export function subshellColor(all: SubshellView[], key: string): string {
  const i = all.findIndex((x) => x.key === key)
  return SUBSHELL_PALETTE[(i < 0 ? 0 : i) % SUBSHELL_PALETTE.length]
}

/** Orbitals to draw for the current state. Single mode: one hydrogen orbital (Z = 1). */
export function deriveParts(s: AppState): OrbitalPart[] {
  if (s.single) return [{ orbital: { n: s.n, l: s.l, m: s.m, Z: 1, real: s.real }, color: SINGLE_COLOR, weight: 1, group: 'single' }]
  const all = elementSubshells(s.Z)
  const shown = visibleSubshells(s)
  // Weights are shares of the total budget, proportional to electrons across the shown subshells.
  const counts = allocateCounts(shown, 1_000_000)
  const sum = [...counts.values()].reduce((a, b) => a + b, 0) || 1
  const parts: OrbitalPart[] = []
  for (const sub of shown) {
    const color = subshellColor(all, sub.key)
    for (const o of sub.orbitals) {
      const key = `${sub.n},${sub.l},${o.m}`
      parts.push({ orbital: { n: sub.n, l: sub.l, m: o.m, Z: sub.Zeff, real: s.real }, color, weight: (counts.get(key) ?? 0) / sum, group: sub.key })
    }
  }
  return parts
}

/** One representative orbital per subshell for the isosurface view (the first occupied m). */
export function isoParts(parts: OrbitalPart[]): OrbitalPart[] {
  const seen = new Set<string>()
  return parts.filter((p) => (seen.has(p.group) ? false : (seen.add(p.group), true)))
}
