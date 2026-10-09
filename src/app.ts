import * as THREE from 'three'
import { SceneManager } from './render/scene'
import { SphereCloud } from './render/sphereCloud'
import { GlowCloud } from './render/glowCloud'
import { makeRadialSprite } from './render/sprite'
import { phaseShades } from './render/colors'
import { DEFAULTS } from './render/defaults'
import { OrbitalWorkerClient } from './worker/client'
import type { SampleResponse } from './worker/protocol'
import { COLORMAPS } from './physics/colormaps'
import type { Orbital } from './physics/orbital'
import { Store, type AppState, type StateKey } from './state'

/** One orbital contributing to the view, with its color and share of the sample budget. */
export interface OrbitalPart {
  orbital: Orbital
  color: string
  weight: number
}

const PREVIEW_COUNT = 5000
const MIN_PART_COUNT = 500

/** Keys whose change requires resampling / remeshing. */
const REBUILD_KEYS: StateKey[] = ['Z', 'single', 'n', 'l', 'm', 'real', 'sphereCount', 'glowCount', 'mode', 'isoFraction', 'gridSize', 'valenceOnly', 'hiddenSubshells']

/** Radius containing `q` of the sampled points: the visible size of the cloud. */
export function percentileRadius(positions: Float32Array, q: number): number {
  const n = positions.length / 3
  if (n === 0) return 1
  const radii = new Float32Array(n)
  for (let i = 0; i < n; i++) radii[i] = Math.hypot(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
  radii.sort()
  return radii[Math.min(n - 1, Math.floor(q * n))]
}

export class App {
  readonly store: Store
  readonly scene: SceneManager
  readonly client: OrbitalWorkerClient
  readonly spheres: SphereCloud
  readonly glow: GlowCloud
  readonly nucleus: THREE.Mesh
  /** Visible cloud radius used for sphere size, point size and framing. */
  fitRadius = 1
  private generation = 0
  private currentOrbitalKey = ''
  private t0 = 0

  constructor(viewport: HTMLElement, store: Store, worker: Worker) {
    this.store = store
    this.scene = new SceneManager(viewport)
    this.client = new OrbitalWorkerClient(worker)
    this.spheres = new SphereCloud(150000)
    this.glow = new GlowCloud(500000, makeRadialSprite())
    this.nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }))
    this.scene.content.add(this.spheres.mesh, this.glow.points, this.nucleus)
    this.applyLook(Object.keys(store.state) as StateKey[])
    store.subscribe((_s, changed) => this.onChange(changed))
    this.scene.start()
    void this.rebuild()
  }

  /** Orbitals to draw for the current state. Single mode: one orbital with Z = 1 (hydrogen). */
  deriveParts(s: AppState): OrbitalPart[] {
    return [{ orbital: { n: s.n, l: s.l, m: s.m, Z: 1, real: s.real }, color: '#2a9d8f', weight: 1 }]
  }

  private onChange(changed: StateKey[]): void {
    this.applyLook(changed)
    if (changed.some((k) => REBUILD_KEYS.includes(k))) void this.rebuild()
  }

  /** Apply in-place look changes that need no resampling. */
  private applyLook(changed: StateKey[]): void {
    const s = this.store.state
    const has = (k: StateKey) => changed.includes(k)
    if (has('mode')) {
      this.scene.setMode(s.mode)
      this.spheres.mesh.visible = s.mode === 'spheres'
      this.glow.points.visible = s.mode === 'glow'
      this.nucleus.visible = s.showNucleus && s.mode !== 'glow'
    }
    if (has('theme')) this.scene.setTheme(s.theme)
    if (has('ao')) this.scene.setAO(s.ao)
    if (has('aoIntensity') || has('sphereRadius')) this.scene.setAOParams({ intensity: s.aoIntensity, radius: DEFAULTS.aoRadiusFactor * this.sphereRadius() })
    if (has('sphereRadius')) { this.spheres.setRadius(this.sphereRadius()); this.nucleus.scale.setScalar(this.sphereRadius() * 1.5) }
    if (has('bloom') || has('bloomStrength') || has('bloomThreshold')) this.scene.setBloom({ enabled: s.bloom, strength: s.bloomStrength, threshold: s.bloomThreshold, radius: DEFAULTS.bloomRadius })
    if (has('exposure')) { this.scene.setExposure(s.exposure); this.glow.setBrightness(s.exposure) }
    if (has('colormap') || has('gamma')) this.glow.setColormap(COLORMAPS[s.colormap], s.gamma)
    if (has('pointSize')) this.glow.setPointSize(this.pointSize())
    if (has('showNucleus')) this.nucleus.visible = s.showNucleus && s.mode !== 'glow'
  }

  sphereRadius(): number { return DEFAULTS.sphereRadiusFactor * this.fitRadius * this.store.state.sphereRadius }
  pointSize(): number { return DEFAULTS.pointSizeFactor * this.fitRadius * this.store.state.pointSize }

  /** Resample for the current state: a quick low-N preview, then the full count. Stale results are dropped. */
  async rebuild(): Promise<void> {
    const gen = ++this.generation
    this.client.cancelAll()
    const s = this.store.state
    const parts = this.deriveParts(s)
    const key = parts.map((p) => JSON.stringify(p.orbital)).join('|')
    const reframe = key !== this.currentOrbitalKey
    this.currentOrbitalKey = key
    this.t0 = performance.now()
    const total = s.mode === 'glow' ? s.glowCount : s.sphereCount
    try {
      for (const budget of [PREVIEW_COUNT, total]) {
        const results = await Promise.all(parts.map((p) => this.client.sample(p.orbital, Math.max(MIN_PART_COUNT, Math.round(budget * p.weight)), 1)))
        if (gen !== this.generation) return
        if (budget === PREVIEW_COUNT) this.frame(results, reframe)
        this.showSamples(parts, results)
        if (import.meta.env.DEV) console.debug(`[atom] ${budget} samples shown at ${(performance.now() - this.t0).toFixed(0)} ms`)
      }
    } catch (e) {
      if ((e as Error).message !== 'cancelled') console.error(e)
    }
  }

  private frame(results: SampleResponse[], reframe: boolean): void {
    const all = concatPositions(results)
    this.fitRadius = percentileRadius(all, 0.95)
    const r = this.sphereRadius()
    this.nucleus.scale.setScalar(r * 1.5)
    this.scene.setAOParams({ radius: DEFAULTS.aoRadiusFactor * r, intensity: this.store.state.aoIntensity })
    this.glow.setPointSize(this.pointSize())
    if (reframe) this.scene.fitCamera(this.fitRadius)
  }

  private showSamples(parts: OrbitalPart[], results: SampleResponse[]): void {
    const s = this.store.state
    if (s.mode === 'glow') {
      const merged = mergeSamples(results)
      this.glow.update(merged.positions, merged.psi, merged.maxDensity, COLORMAPS[s.colormap], s.gamma)
    } else {
      const merged = mergeSamples(results)
      // Single-part color for now; Task 16 colors per part.
      const { pos, neg } = phaseShades(parts[0].color)
      this.spheres.update(merged.positions, merged.psi, pos, neg, this.sphereRadius())
    }
  }

  dispose(): void {
    this.client.dispose()
    this.spheres.dispose()
    this.glow.dispose()
    this.scene.dispose()
  }
}

function concatPositions(results: SampleResponse[]): Float32Array {
  if (results.length === 1) return results[0].positions
  const total = results.reduce((a, r) => a + r.positions.length, 0)
  const out = new Float32Array(total)
  let o = 0
  for (const r of results) { out.set(r.positions, o); o += r.positions.length }
  return out
}

function mergeSamples(results: SampleResponse[]): { positions: Float32Array; psi: Float32Array; maxDensity: number } {
  if (results.length === 1) return results[0]
  const n = results.reduce((a, r) => a + r.psi.length, 0)
  const positions = new Float32Array(n * 3), psi = new Float32Array(n)
  let o = 0, maxDensity = 0
  for (const r of results) {
    positions.set(r.positions, o * 3)
    psi.set(r.psi, o)
    o += r.psi.length
    maxDensity = Math.max(maxDensity, r.maxDensity)
  }
  return { positions, psi, maxDensity }
}
