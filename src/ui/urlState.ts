import { DEFAULT_STATE, type AppState } from '../state'
import { clampOrbital } from '../physics/orbital'
import { elementByZ } from '../physics/elements'

const MODES = ['spheres', 'glow', 'iso'] as const
const THEMES = ['light', 'dark'] as const

const int = (v: string | null): number | undefined => {
  if (v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : undefined
}
const num = (v: string | null): number | undefined => {
  if (v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : undefined

/** Parse `?Z=26&mode=iso&n=3&l=2&m=0&single=1&N=50000&theme=dark&iso=0.9&real=1`; invalid values fall back to `base`. */
export function stateFromSearch(search: string, base: AppState): AppState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out: AppState = { ...base }
  const Z = int(q.get('Z'))
  if (Z !== undefined && elementByZ(Z)) out.Z = Z
  const single = q.get('single')
  if (single !== null) out.single = single !== '0' && single !== 'false'
  else if (Z !== undefined && elementByZ(Z)) out.single = false
  const orb = clampOrbital(int(q.get('n')) ?? base.n, int(q.get('l')) ?? base.l, int(q.get('m')) ?? base.m)
  out.n = orb.n; out.l = orb.l; out.m = orb.m
  out.mode = oneOf(q.get('mode'), MODES) ?? base.mode
  out.theme = oneOf(q.get('theme'), THEMES) ?? base.theme
  const real = q.get('real')
  if (real !== null) out.real = real !== '0' && real !== 'false'
  const N = int(q.get('N'))
  if (N !== undefined) {
    if (out.mode === 'glow') out.glowCount = Math.min(500000, Math.max(100000, N))
    else out.sphereCount = Math.min(150000, Math.max(5000, N))
  }
  const iso = num(q.get('iso'))
  if (iso !== undefined && iso >= 0.5 && iso <= 0.99) out.isoFraction = iso
  return out
}

/** Query string for the keys that differ from the defaults ('' when none). */
export function searchFromState(s: AppState): string {
  const q = new URLSearchParams()
  if (s.Z !== DEFAULT_STATE.Z) q.set('Z', String(s.Z))
  if (s.n !== DEFAULT_STATE.n || s.l !== DEFAULT_STATE.l || s.m !== DEFAULT_STATE.m) {
    q.set('n', String(s.n)); q.set('l', String(s.l)); q.set('m', String(s.m))
  }
  if (s.single !== DEFAULT_STATE.single || q.has('Z') || q.has('n')) q.set('single', s.single ? '1' : '0')
  if (s.mode !== DEFAULT_STATE.mode) q.set('mode', s.mode)
  if (s.theme !== DEFAULT_STATE.theme) q.set('theme', s.theme)
  if (s.real !== DEFAULT_STATE.real) q.set('real', s.real ? '1' : '0')
  if (s.mode === 'glow' ? s.glowCount !== DEFAULT_STATE.glowCount : s.sphereCount !== DEFAULT_STATE.sphereCount) q.set('N', String(s.mode === 'glow' ? s.glowCount : s.sphereCount))
  if (s.isoFraction !== DEFAULT_STATE.isoFraction) q.set('iso', String(s.isoFraction))
  const str = q.toString()
  return str ? `?${str}` : ''
}
