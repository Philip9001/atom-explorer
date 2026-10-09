import { groundStateConfiguration, isValenceSubshell, occupiedOrbitals } from './configuration'
import { slaterZeff } from './slater'
import { subshellLabel } from './orbital'

export interface SubshellView {
  /** e.g. '3d' */
  key: string
  n: number
  l: number
  electrons: number
  /** Slater effective nuclear charge for this subshell. */
  Zeff: number
  valence: boolean
  /** Occupied real orbitals (Hund filling) with their electron counts. */
  orbitals: { m: number; electrons: number }[]
}

/** The occupied subshells of element Z in configuration order, each with its Z_eff. */
export function elementSubshells(Z: number): SubshellView[] {
  const cfg = groundStateConfiguration(Z)
  return cfg.map((s) => ({
    key: subshellLabel(s.n, s.l),
    n: s.n,
    l: s.l,
    electrons: s.electrons,
    Zeff: slaterZeff(cfg, s.n, s.l),
    valence: isValenceSubshell(cfg, s),
    orbitals: occupiedOrbitals(s),
  }))
}

/**
 * Sample budget per orbital, keyed `${n},${l},${m}`: proportional to the orbital's
 * electron count, with a floor so every toggled subshell stays visible.
 */
export function allocateCounts(subshells: SubshellView[], total: number, minPerOrbital = 500): Map<string, number> {
  const Z = subshells.reduce((a, s) => a + s.electrons, 0)
  const out = new Map<string, number>()
  for (const s of subshells) {
    for (const o of s.orbitals) out.set(`${s.n},${s.l},${o.m}`, Math.max(minPerOrbital, Math.round((total * o.electrons) / Math.max(1, Z))))
  }
  return out
}
