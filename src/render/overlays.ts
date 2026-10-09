import * as THREE from 'three'

/** Axes helper and a textured slice plane (x-z plane at y = 0) sized to the visible cloud. */
export class Overlays {
  readonly group = new THREE.Group()
  readonly axes: THREE.AxesHelper
  readonly slice: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  readonly sliceTexture: THREE.CanvasTexture

  constructor(sliceCanvas: HTMLCanvasElement) {
    this.axes = new THREE.AxesHelper(1)
    this.sliceTexture = new THREE.CanvasTexture(sliceCanvas)
    this.sliceTexture.colorSpace = THREE.SRGBColorSpace
    this.slice = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.sliceTexture, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    )
    // PlaneGeometry lies in x-y; rotate so it spans x-z (normal along +y).
    this.slice.rotation.x = Math.PI / 2
    this.group.add(this.axes, this.slice)
  }

  /** Fit to a half-extent (the slice spans [-half, half] in x and z; axes reach 1.3 half). */
  setExtent(half: number): void {
    this.slice.scale.setScalar(half)
    this.axes.scale.setScalar(half * 1.3)
  }

  refreshSlice(): void { this.sliceTexture.needsUpdate = true }

  dispose(): void {
    this.axes.dispose()
    this.slice.geometry.dispose()
    this.slice.material.dispose()
    this.sliceTexture.dispose()
  }
}
