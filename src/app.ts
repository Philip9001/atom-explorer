import * as THREE from 'three'
import { SceneManager } from './render/scene'
import { SphereCloud } from './render/sphereCloud'
import { GlowCloud } from './render/glowCloud'
import { IsoSurfaceSet } from './render/isosurface'
import { Overlays } from './render/overlays'
import { BohrView } from './render/bohr'
import { sliceDensity } from './physics/slice'
import { groundStateConfiguration, shellCounts } from './physics/configuration'
import { paintSlice } from './ui/sliceInset'
import { renderStillBlob, downloadBlob } from './render/still'
import { orbitalLabel } from './physics/orbital'
import { elementByZ } from './physics/elements'
import { singleFlight } from './util/singleFlight'
import { makeRadialSprite } from './render/sprite'
import { phaseShades } from './render/colors'
import { DEFAULTS } from './render/defaults'
import { OrbitalWorkerClient } from './worker/client'
import type { GridResponse, SampleResponse } from './worker/protocol'
import { COLORMAPS } from './physics/colormaps'
import { deriveParts, isoParts } from './parts'
import { Store, type StateKey } from './state'
import type { OrbitalPart } from './parts'

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
  readonly iso: IsoSurfaceSet
  readonly overlays: Overlays
  readonly bohr = new BohrView()
  readonly nucleus: THREE.Mesh
  /** Called after framing and after each completed rebuild, for side-panel plots. */
  onUpdate?: (info: { parts: OrbitalPart[]; fitRadius: number }) => void
  private parts: OrbitalPart[] = []
  private sliceCanvas: HTMLCanvasElement
  /** Visible cloud radius used for sphere size, point size and framing. */
  fitRadius = 1
  private generation = 0
  private currentOrbitalKey = ''
  private t0 = 0

  constructor(viewport: HTMLElement, store: Store, worker: Worker, ui: { sliceCanvas: HTMLCanvasElement }) {
    this.store = store
    this.sliceCanvas = ui.sliceCanvas
    this.scene = new SceneManager(viewport)
    this.client = new OrbitalWorkerClient(worker)
    this.spheres = new SphereCloud(150000)
    this.glow = new GlowCloud(500000, makeRadialSprite())
    this.iso = new IsoSurfaceSet()
    this.overlays = new Overlays(ui.sliceCanvas)
    this.nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }))
    this.scene.content.add(this.spheres.mesh, this.glow.points, this.iso.group, this.nucleus, this.overlays.group)
    this.scene.scene.add(this.bohr.group)
    this.applyLook(Object.keys(store.state) as StateKey[])
    store.subscribe((_s, changed) => this.onChange(changed))
    this.scene.start()
    void this.rebuild()
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
      this.iso.group.visible = s.mode === 'iso'
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
    if (has('showAxes')) this.overlays.axes.visible = s.showAxes
    if (has('showSlice') || has('colormap') || has('gamma')) { this.overlays.slice.visible = s.showSlice; this.paintSlice() }
    if (has('bohr') || has('Z') || has('single')) this.updateBohr()
  }

  /** Repaint the slice canvas (side-panel inset and 3D plane) from the current parts. */
  private paintSlice(): void {
    const s = this.store.state
    if (!s.showSlice) return
    const size = 128
    const field = sliceDensity(this.parts, size, this.fitRadius * 1.2)
    paintSlice(this.sliceCanvas, field, size, s.colormap, s.gamma)
    this.overlays.refreshSlice()
  }

  private updateBohr(): void {
    const s = this.store.state
    this.scene.content.visible = !s.bohr
    this.bohr.group.visible = s.bohr
    if (!s.bohr) { this.bohr.clear(); return }
    const counts = s.single ? [1] : shellCounts(groundStateConfiguration(s.Z))
    this.bohr.update(counts, this.fitRadius / (counts.length + 0.5))
  }

  sphereRadius(): number { return DEFAULTS.sphereRadiusFactor * this.fitRadius * this.store.state.sphereRadius }
  pointSize(): number { return DEFAULTS.pointSizeFactor * this.fitRadius * this.store.state.pointSize }

  /** Resample for the current state: a quick low-N preview, then the full count. Stale results are dropped. */
  async rebuild(): Promise<void> {
    const gen = ++this.generation
    this.client.cancelAll()
    const s = this.store.state
    const parts = deriveParts(s)
    this.parts = parts
    const key = parts.map((p) => JSON.stringify(p.orbital)).join('|')
    const reframe = key !== this.currentOrbitalKey
    this.currentOrbitalKey = key
    this.t0 = performance.now()
    const total = s.mode === 'glow' ? s.glowCount : s.sphereCount
    try {
      // The preview also serves iso mode: it frames the camera while the grid is computed.
      const budgets = s.mode === 'iso' ? [PREVIEW_COUNT] : [PREVIEW_COUNT, total]
      for (const budget of budgets) {
        const results = await Promise.all(parts.map((p) => this.client.sample(p.orbital, Math.max(MIN_PART_COUNT, Math.round(budget * p.weight)), 1)))
        if (gen !== this.generation) return
        if (budget === PREVIEW_COUNT) { this.frame(results, reframe); this.paintSlice(); this.onUpdate?.({ parts, fitRadius: this.fitRadius }) }
        if (s.mode !== 'iso') this.showSamples(parts, results)
        if (import.meta.env.DEV) console.debug(`[atom] ${budget} samples shown at ${(performance.now() - this.t0).toFixed(0)} ms`)
      }
      if (s.mode === 'iso') {
        const ip = isoParts(parts)
        const grids = await Promise.all(ip.map((p) => this.client.grid(p.orbital, s.gridSize, s.isoFraction)))
        if (gen !== this.generation) return
        this.showGrids(ip, grids)
        if (import.meta.env.DEV) console.debug(`[atom] isosurface shown at ${(performance.now() - this.t0).toFixed(0)} ms`)
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
    this.overlays.setExtent(this.fitRadius * 1.2)
    if (reframe) this.scene.fitCamera(this.fitRadius)
    if (this.store.state.bohr) this.updateBohr()
  }

  private showSamples(parts: OrbitalPart[], results: SampleResponse[]): void {
    const s = this.store.state
    if (s.mode === 'glow') {
      this.glow.updateMany(results.map((r) => ({ positions: r.positions, psi: r.psi, maxDensity: r.maxDensity })), COLORMAPS[s.colormap], s.gamma)
    } else {
      this.spheres.updateMany(results.map((r, i) => ({ positions: r.positions, psi: r.psi, ...phaseShades(parts[i].color), phase: s.real ? undefined : r.phase })), this.sphereRadius())
    }
  }

  private showGrids(parts: OrbitalPart[], grids: GridResponse[]): void {
    this.iso.update(grids.map((g, i) => ({ key: parts[i].group, positions: g.positions, normals: g.normals, signs: g.signs, color: parts[i].color })))
  }

  /** High-quality still: 2x samples, 2x pixel ratio, stronger AO, optional DOF; restores the live view after. */
  renderStill(opts: { dof?: boolean; download?: boolean } = {}): Promise<Blob> {
    // One still at a time: a second press while rendering joins the first instead of doubling the pixel ratio.
    if (!this.stillFlight) this.stillFlight = singleFlight(() => this.renderStillNow(this.stillOpts))
    this.stillOpts = opts
    return this.stillFlight()
  }

  private stillFlight: (() => Promise<Blob>) | null = null
  private stillOpts: { dof?: boolean; download?: boolean } = {}

  private async renderStillNow(opts: { dof?: boolean; download?: boolean }): Promise<Blob> {
    const s = this.store.state
    const parts = deriveParts(s)
    const gen = ++this.generation
    this.client.cancelAll()
    if (s.mode !== 'iso') {
      const total = (s.mode === 'glow' ? s.glowCount : s.sphereCount) * 2
      const budget = Math.min(total, s.mode === 'glow' ? this.glow.capacity : this.spheres.capacity)
      const results = await Promise.all(parts.map((p) => this.client.sample(p.orbital, Math.max(MIN_PART_COUNT, Math.round(budget * p.weight)), 1)))
      if (gen !== this.generation) throw new Error('cancelled')
      this.showSamples(parts, results)
    }
    try {
      const blob = await renderStillBlob(this.scene, { scale: 2, aoIntensity: s.aoIntensity * 1.5, dof: opts.dof ?? false })
      if (opts.download !== false) {
        const label = s.single ? orbitalLabel({ n: s.n, l: s.l, m: s.m, real: s.real }) : (elementByZ(s.Z)?.symbol ?? `Z${s.Z}`)
        downloadBlob(blob, `atom-${label}-${s.mode}.png`)
      }
      return blob
    } finally {
      if (gen === this.generation) void this.rebuild()
    }
  }

  dispose(): void {
    this.overlays.dispose()
    this.bohr.dispose()
    this.iso.dispose()
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

