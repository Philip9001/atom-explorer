import type { RenderMode } from './render/postprocessing'
import type { Theme } from './render/scene'
import type { ColormapName } from './physics/colormaps'

export interface AppState {
  Z: number
  single: boolean
  n: number
  l: number
  m: number
  real: boolean
  mode: RenderMode
  theme: Theme
  sphereCount: number
  sphereRadius: number
  ao: boolean
  aoIntensity: number
  glowCount: number
  pointSize: number
  colormap: ColormapName
  gamma: number
  exposure: number
  bloom: boolean
  bloomStrength: number
  bloomThreshold: number
  isoFraction: number
  gridSize: number
  showNucleus: boolean
  showAxes: boolean
  showSlice: boolean
  showRadial: boolean
  bohr: boolean
  valenceOnly: boolean
  /** Subshell keys such as '1s', '2p' hidden in the element view. */
  hiddenSubshells: string[]
}

export const DEFAULT_STATE: AppState = {
  Z: 1,
  single: true,
  n: 3,
  l: 2,
  m: 0,
  real: true,
  mode: 'spheres',
  theme: 'light',
  sphereCount: 50000,
  sphereRadius: 1,
  ao: true,
  aoIntensity: 1.2,
  glowCount: 300000,
  pointSize: 1,
  colormap: 'inferno',
  gamma: 0.35,
  exposure: 1,
  bloom: true,
  bloomStrength: 0.6,
  bloomThreshold: 0.6,
  isoFraction: 0.9,
  gridSize: 96,
  showNucleus: true,
  showAxes: false,
  showSlice: false,
  showRadial: true,
  bohr: false,
  valenceOnly: false,
  hiddenSubshells: [],
}

export type StateKey = keyof AppState
type Listener = (state: AppState, changed: StateKey[]) => void

function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i])
  return a === b
}

/** Single source of truth for the UI; notifies subscribers with the list of changed keys. */
export class Store {
  private current: AppState
  private listeners = new Set<Listener>()

  constructor(initial: Partial<AppState> = {}) {
    this.current = { ...DEFAULT_STATE, ...initial }
  }

  get state(): AppState { return this.current }

  set(patch: Partial<AppState>): void {
    const changed: StateKey[] = []
    const next = { ...this.current }
    for (const key of Object.keys(patch) as StateKey[]) {
      const value = patch[key]
      if (value === undefined || equal(this.current[key], value)) continue
      ;(next as Record<string, unknown>)[key] = value
      changed.push(key)
    }
    if (changed.length === 0) return
    this.current = next
    for (const fn of this.listeners) fn(next, changed)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
}
