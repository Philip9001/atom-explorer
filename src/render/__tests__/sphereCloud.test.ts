import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { SphereCloud } from '../sphereCloud'

describe('SphereCloud', () => {
  it('writes instance matrices and phase colors directly from typed arrays', () => {
    const cloud = new SphereCloud(10)
    const positions = new Float32Array([1, 2, 3, -1, -2, -3])
    const psi = new Float32Array([0.5, -0.5])
    const pos = new THREE.Color(1, 0, 0), neg = new THREE.Color(0, 0, 1)
    cloud.update(positions, psi, pos, neg, 0.25)
    expect(cloud.mesh.count).toBe(2)
    const m = cloud.mesh.instanceMatrix.array
    expect(Array.from(m.slice(0, 16))).toEqual([0.25, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0.25, 0, 1, 2, 3, 1])
    expect(Array.from(m.slice(16 + 12, 16 + 15))).toEqual([-1, -2, -3])
    const c = cloud.mesh.instanceColor!.array
    expect(Array.from(c.slice(0, 6))).toEqual([1, 0, 0, 0, 0, 1])
    expect(cloud.mesh.instanceMatrix.needsUpdate || cloud.mesh.instanceMatrix.version > 0).toBe(true)
  })
  it('setRadius rescales in place without touching translation', () => {
    const cloud = new SphereCloud(4)
    cloud.update(new Float32Array([5, 6, 7]), new Float32Array([1]), new THREE.Color(1, 1, 1), new THREE.Color(0, 0, 0), 1)
    cloud.setRadius(0.1)
    const m = cloud.mesh.instanceMatrix.array
    expect(m[0]).toBeCloseTo(0.1)
    expect(m[5]).toBeCloseTo(0.1)
    expect(m[10]).toBeCloseTo(0.1)
    expect(Array.from(m.slice(12, 15))).toEqual([5, 6, 7])
  })
  it('clamps to capacity and reuses buffers (no new geometry per update)', () => {
    const cloud = new SphereCloud(2)
    const geo = cloud.mesh.geometry
    cloud.update(new Float32Array(9), new Float32Array(3), new THREE.Color(), new THREE.Color(), 1)
    expect(cloud.mesh.count).toBe(2)
    cloud.update(new Float32Array(3), new Float32Array(1), new THREE.Color(), new THREE.Color(), 1)
    expect(cloud.mesh.geometry).toBe(geo)
  })
})
