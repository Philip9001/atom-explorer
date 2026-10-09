export interface Orbital {
  n: number
  l: number
  m: number
  /** Nuclear charge (or Slater effective charge) in units of e. */
  Z: number
  /** true: real (tesseral) harmonics, false: complex e^{i m phi}. */
  real: boolean
}

export const MAX_N = 7
export const SUBSHELL_LETTERS = 'spdfghi'

export function isValidOrbital(o: { n: number; l: number; m: number }): boolean {
  return (
    Number.isInteger(o.n) && Number.isInteger(o.l) && Number.isInteger(o.m) &&
    o.n >= 1 && o.n <= MAX_N && o.l >= 0 && o.l < o.n && Math.abs(o.m) <= o.l
  )
}

/** Clamp arbitrary (possibly NaN) numbers to a valid (n, l, m) triple. */
export function clampOrbital(n: number, l: number, m: number): { n: number; l: number; m: number } {
  const cn = Number.isFinite(n) ? Math.min(MAX_N, Math.max(1, Math.round(n))) : 1
  const cl = Number.isFinite(l) ? Math.min(cn - 1, Math.max(0, Math.round(l))) : 0
  const cm = Number.isFinite(m) ? Math.min(cl, Math.max(-cl, Math.round(m))) : 0
  return { n: cn, l: cl, m: cm }
}

// Standard real-orbital names; m > 0 are cos(m phi) (x-type), m < 0 are sin(|m| phi) (y-type).
const REAL_NAMES: Record<number, Record<number, string>> = {
  0: { 0: 's' },
  1: { 0: 'pz', 1: 'px', [-1]: 'py' },
  2: { 0: 'dz2', 1: 'dxz', [-1]: 'dyz', 2: 'dx2-y2', [-2]: 'dxy' },
  3: { 0: 'fz3', 1: 'fxz2', [-1]: 'fyz2', 2: 'fz(x2-y2)', [-2]: 'fxyz', 3: 'fx(x2-3y2)', [-3]: 'fy(3x2-y2)' },
}

export function realOrbitalName(l: number, m: number): string {
  return REAL_NAMES[l]?.[m] ?? `${SUBSHELL_LETTERS[l] ?? `l${l}`}(m=${m})`
}

export function subshellLabel(n: number, l: number): string {
  return `${n}${SUBSHELL_LETTERS[l] ?? `l${l}`}`
}

export function orbitalLabel(o: { n: number; l: number; m: number; real?: boolean; Z?: number }): string {
  if (o.real === false) return `${subshellLabel(o.n, o.l)} m=${o.m}`
  return `${o.n}${realOrbitalName(o.l, o.m)}`
}
