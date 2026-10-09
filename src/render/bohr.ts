import * as THREE from 'three'

/** Classic flat shell model: one ring per shell with evenly spaced electrons. */
export class BohrView {
  readonly group = new THREE.Group()
  private disposables: { dispose(): void }[] = []

  /** `counts[i]` electrons in shell n = i + 1; `unit` is the ring spacing in world units. */
  update(counts: number[], unit: number): void {
    this.clear()
    const ringMat = new THREE.LineBasicMaterial({ color: 0x8a8a94 })
    const nucleusGeo = new THREE.SphereGeometry(unit * 0.22, 24, 12)
    const nucleusMat = new THREE.MeshStandardMaterial({ color: 0xd04040, roughness: 0.5 })
    this.group.add(new THREE.Mesh(nucleusGeo, nucleusMat))
    const electronGeo = new THREE.SphereGeometry(unit * 0.09, 16, 8)
    const electronMat = new THREE.MeshStandardMaterial({ color: 0x2a6fd6, roughness: 0.4 })
    this.disposables.push(ringMat, nucleusGeo, nucleusMat, electronGeo, electronMat)
    counts.forEach((count, i) => {
      const radius = unit * (i + 1)
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 96; k++) {
        const a = (2 * Math.PI * k) / 96
        pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)))
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts)
      this.disposables.push(ringGeo)
      this.group.add(new THREE.Line(ringGeo, ringMat))
      for (let e = 0; e < count; e++) {
        const a = (2 * Math.PI * e) / count + i * 0.3
        const m = new THREE.Mesh(electronGeo, electronMat)
        m.position.set(radius * Math.cos(a), 0, radius * Math.sin(a))
        this.group.add(m)
      }
    })
  }

  clear(): void {
    this.group.clear()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }

  dispose(): void { this.clear() }
}
