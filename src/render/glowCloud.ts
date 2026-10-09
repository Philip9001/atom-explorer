import * as THREE from 'three'
import { colormapLookup } from '../physics/colormaps'

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
  private maxDensity = 1
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
    const n = Math.min(this.capacity, psi.length, positions.length / 3)
    ;(this.positionAttr.array as Float32Array).set(positions.subarray(0, n * 3))
    this.positionAttr.needsUpdate = true
    this.psi = psi
    this.maxDensity = maxDensity
    this.setCount(n)
    this.setColormap(map, gamma)
    this.geometry.computeBoundingSphere()
  }

  /** Recolor from cached psi: t = (psi^2 / maxDensity)^gamma through the LUT. */
  setColormap(map: Float32Array, gamma: number): void {
    if (!this.psi) return
    const c = this.colorAttr.array as Float32Array
    const inv = this.maxDensity > 0 ? 1 / this.maxDensity : 0
    for (let i = 0; i < this.count; i++) {
      const d = this.psi[i] * this.psi[i] * inv
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
