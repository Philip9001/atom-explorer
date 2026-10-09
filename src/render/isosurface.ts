import * as THREE from 'three'
import { phaseShades } from './colors'

function makeMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.35, metalness: 0,
    side: THREE.DoubleSide, depthWrite: false,
  })
}

/** Two semi-transparent meshes (positive / negative lobes) built from a marching-cubes triangle soup. */
export class IsoSurface {
  readonly group = new THREE.Group()
  readonly positive: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
  readonly negative: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>

  constructor() {
    this.positive = new THREE.Mesh(new THREE.BufferGeometry(), makeMaterial())
    this.negative = new THREE.Mesh(new THREE.BufferGeometry(), makeMaterial())
    this.positive.frustumCulled = this.negative.frustumCulled = false
    this.group.add(this.positive, this.negative)
  }

  update(positions: Float32Array, normals: Float32Array, signs: Int8Array, pos: THREE.Color, neg: THREE.Color): void {
    const counts = [0, 0]
    for (let i = 0; i < signs.length; i += 3) counts[signs[i] >= 0 ? 0 : 1] += 3
    const out = [
      { p: new Float32Array(counts[0] * 3), n: new Float32Array(counts[0] * 3), o: 0 },
      { p: new Float32Array(counts[1] * 3), n: new Float32Array(counts[1] * 3), o: 0 },
    ]
    for (let i = 0; i < signs.length; i += 3) {
      const t = out[signs[i] >= 0 ? 0 : 1]
      t.p.set(positions.subarray(3 * i, 3 * i + 9), t.o)
      t.n.set(normals.subarray(3 * i, 3 * i + 9), t.o)
      t.o += 9
    }
    this.replace(this.positive, out[0].p, out[0].n, pos)
    this.replace(this.negative, out[1].p, out[1].n, neg)
  }

  private replace(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>, p: Float32Array, n: Float32Array, color: THREE.Color): void {
    mesh.geometry.dispose()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
    mesh.geometry = g
    mesh.material.color.copy(color)
  }

  setOpacity(o: number): void {
    this.positive.material.opacity = o
    this.negative.material.opacity = o
  }

  dispose(): void {
    for (const m of [this.positive, this.negative]) { m.geometry.dispose(); m.material.dispose() }
  }
}

export interface IsoPart { key: string; positions: Float32Array; normals: Float32Array; signs: Int8Array; color: string }

/** One IsoSurface per key (subshell); surfaces whose key disappears are disposed. */
export class IsoSurfaceSet {
  readonly group = new THREE.Group()
  readonly surfaces = new Map<string, IsoSurface>()

  update(parts: IsoPart[]): void {
    const keep = new Set(parts.map((p) => p.key))
    for (const [key, surf] of this.surfaces) {
      if (!keep.has(key)) {
        this.group.remove(surf.group)
        surf.dispose()
        this.surfaces.delete(key)
      }
    }
    for (const p of parts) {
      let surf = this.surfaces.get(p.key)
      if (!surf) {
        surf = new IsoSurface()
        this.surfaces.set(p.key, surf)
        this.group.add(surf.group)
      }
      const { pos, neg } = phaseShades(p.color)
      surf.update(p.positions, p.normals, p.signs, pos, neg)
    }
  }

  setOpacity(o: number): void { for (const s of this.surfaces.values()) s.setOpacity(o) }

  dispose(): void {
    for (const s of this.surfaces.values()) s.dispose()
    this.surfaces.clear()
  }
}
