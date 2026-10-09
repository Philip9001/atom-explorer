import * as THREE from 'three'

export interface SpherePart { positions: Float32Array; psi: Float32Array; pos: THREE.Color; neg: THREE.Color }

/**
 * A point cloud drawn as lit, instanced low-poly spheres. Instance matrices and
 * colors are written straight into the attribute arrays (no setMatrixAt loop).
 */
export class SphereCloud {
  readonly mesh: THREE.InstancedMesh
  readonly capacity: number
  private material: THREE.MeshStandardMaterial
  private detail: 1 | 2 = 2
  private radius = 1

  constructor(maxCount: number) {
    this.capacity = maxCount
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 })
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, this.detail), this.material, maxCount)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
  }

  update(positions: Float32Array, psi: Float32Array, pos: THREE.Color, neg: THREE.Color, radius: number): void {
    this.updateMany([{ positions, psi, pos, neg }], radius)
  }

  /** Several sample sets, each with its own phase color pair, concatenated into the one mesh. */
  updateMany(parts: SpherePart[], radius: number): void {
    this.radius = radius
    const m = this.mesh.instanceMatrix.array as Float32Array
    const c = this.mesh.instanceColor!.array as Float32Array
    let i = 0
    outer: for (const { positions, psi, pos, neg } of parts) {
      const n = Math.min(psi.length, positions.length / 3)
      for (let k = 0; k < n; k++, i++) {
        if (i >= this.capacity) break outer
        const o = i * 16
        m[o] = radius; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0
        m[o + 4] = 0; m[o + 5] = radius; m[o + 6] = 0; m[o + 7] = 0
        m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = radius; m[o + 11] = 0
        m[o + 12] = positions[3 * k]; m[o + 13] = positions[3 * k + 1]; m[o + 14] = positions[3 * k + 2]; m[o + 15] = 1
        const col = psi[k] >= 0 ? pos : neg
        c[3 * i] = col.r; c[3 * i + 1] = col.g; c[3 * i + 2] = col.b
      }
    }
    this.mesh.count = i
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor!.needsUpdate = true
    const wanted: 1 | 2 = i > 50000 ? 1 : 2
    if (wanted !== this.detail) this.setDetail(wanted)
  }

  /** Rescale every instance's diagonal in place; translation untouched. */
  setRadius(radius: number): void {
    this.radius = radius
    const m = this.mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < this.mesh.count; i++) {
      const o = i * 16
      m[o] = radius; m[o + 5] = radius; m[o + 10] = radius
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  get currentRadius(): number { return this.radius }

  setDetail(detail: 1 | 2): void {
    if (detail === this.detail) return
    this.detail = detail
    this.mesh.geometry.dispose()
    this.mesh.geometry = new THREE.IcosahedronGeometry(1, detail)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
