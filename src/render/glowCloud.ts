import * as THREE from 'three'
import { colormapLookup } from '../physics/colormaps'

export interface GlowPart { positions: Float32Array; psi: Float32Array; maxDensity: number }

/**
 * Additive-blended point cloud colored by local density through a heat colormap.
 * Positions and psi are cached so the colormap/gamma can change without resampling.
 */
export class GlowCloud {
  readonly points: THREE.Points
  readonly material: THREE.PointsMaterial
  readonly capacity: number
  private geometry: THREE.BufferGeometry
  private positionAttr: THREE.BufferAttribute
  private colorAttr: THREE.BufferAttribute
  private psi: Float32Array | null = null
  /** Per-point 1/maxDensity, so parts from different orbitals are each normalized to their own peak. */
  private invMax: Float32Array | null = null
  private count = 0
  private brightness = 1

  constructor(maxCount: number, sprite?: THREE.Texture) {
    this.capacity = maxCount
    this.geometry = new THREE.BufferGeometry()
    this.positionAttr = new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3)
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3)
    this.positionAttr.setUsage(THREE.DynamicDrawUsage)
    this.colorAttr.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', this.positionAttr)
    this.geometry.setAttribute('color', this.colorAttr)
    this.geometry.setDrawRange(0, 0)
    this.material = new THREE.PointsMaterial({
      size: 1,
      vertexColors: true,
      map: sprite ?? null,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  update(positions: Float32Array, psi: Float32Array, maxDensity: number, map: Float32Array, gamma: number): void {
    this.updateMany([{ positions, psi, maxDensity }], map, gamma)
  }

  /** Several sample sets concatenated; each is normalized by its own maxDensity. */
  updateMany(parts: GlowPart[], map: Float32Array, gamma: number): void {
    const total = Math.min(this.capacity, parts.reduce((a, p) => a + p.psi.length, 0))
    const pa = this.positionAttr.array as Float32Array
    const psi = new Float32Array(total)
    const invMax = new Float32Array(total)
    let i = 0
    for (const p of parts) {
      const n = Math.min(p.psi.length, total - i)
      if (n <= 0) break
      pa.set(p.positions.subarray(0, n * 3), i * 3)
      psi.set(p.psi.subarray(0, n), i)
      invMax.fill(p.maxDensity > 0 ? 1 / p.maxDensity : 0, i, i + n)
      i += n
    }
    this.positionAttr.needsUpdate = true
    this.psi = psi
    this.invMax = invMax
    this.setCount(total)
    this.setColormap(map, gamma)
    this.geometry.computeBoundingSphere()
  }

  /** Recolor from cached psi: t = (psi^2 / maxDensity)^gamma through the LUT. */
  setColormap(map: Float32Array, gamma: number): void {
    if (!this.psi || !this.invMax) return
    const c = this.colorAttr.array as Float32Array
    for (let i = 0; i < this.count; i++) {
      const d = this.psi[i] * this.psi[i] * this.invMax[i]
      colormapLookup(map, Math.pow(d, gamma), c, 3 * i)
    }
    this.colorAttr.needsUpdate = true
  }

  setPointSize(size: number): void { this.material.size = size }

  /** Additive blending saturates with N, so opacity ~ brightness / sqrt(N). */
  setCount(n: number): void {
    this.count = n
    this.geometry.setDrawRange(0, n)
    this.applyOpacity()
  }

  /** Multiplier on the per-point opacity (an exposure-like control for the glow). */
  setBrightness(b: number): void {
    this.brightness = b
    this.applyOpacity()
  }

  private applyOpacity(): void {
    this.material.opacity = Math.min(1, Math.max(0.005, (this.brightness * 25) / Math.sqrt(Math.max(1, this.count))))
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
